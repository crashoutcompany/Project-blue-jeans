import { formatClosetCatalog } from "@/lib/ai/lookbook/catalog";
import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { requireSql } from "@/lib/db";
import { loadGarmentCatalog, loadGarmentsByIds } from "@/lib/garments/load-catalog";
import { logServerError } from "@/lib/server/safe-client-error";
import type { WeeklyOutfitsInput } from "@/lib/workflows/types";

const WEEKLY_JOB_FAILED_PUBLIC =
  "Weekly outfits job failed. Check server logs for details.";

export type WeeklyOutfitsJobResult =
  | { ok: true; planId: string; skipped: true }
  | { ok: true; planId: string; skipped: false }
  | { ok: false; error: string; planId?: string };

const MAX_NARRATIVE = 2000;
const WEEKLY_DAYS = 7;

async function markPlanFailed(planId: string, message: string): Promise<void> {
  const sql = requireSql();
  const msg = message.slice(0, 2000);
  await sql`
    UPDATE weekly_outfit_plans
    SET
      status = 'failed',
      error_message = ${msg},
      updated_at = now()
    WHERE id = ${planId}
  `;
}

function buildWeeklyStep1Raw(plans: LookbookPlan[]) {
  const curatorNote = plans
    .map((p) => p.curatorNote?.trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    source: "weekly_parallel_step1" as const,
    plans,
    curatorNote: curatorNote.length > 0 ? curatorNote : undefined,
  };
}

/**
 * Weekly cron: **7 parallel** step-1 calls (one outfit per weekday), then **7 parallel**
 * hero-image calls. Same models as the generator; no batch/GCS.
 */
export async function runWeeklyOutfitsJob(
  input: WeeklyOutfitsInput,
): Promise<WeeklyOutfitsJobResult> {
  if (!hasGeminiCredentials()) {
    return {
      ok: false,
      error:
        "Missing Vertex credentials. Set GOOGLE_VERTEX_PROJECT and authenticate (see docs/vertex-ai-env.md).",
    };
  }

  const narrative = input.narrative.trim().slice(0, MAX_NARRATIVE);
  const climate = input.climate.trim().slice(0, 80);
  const context = input.context.trim().slice(0, 80);

  if (!climate || !context) {
    return { ok: false, error: "Climate and context are required." };
  }

  const sql = requireSql();

  const existingRows = (await sql`
    SELECT id, status::text AS status
    FROM weekly_outfit_plans
    WHERE week_start = ${input.weekStart}::date
    LIMIT 1
  `) as { id: string; status: string }[];

  const row = existingRows[0];
  if (row?.status === "completed") {
    return { ok: true, planId: row.id, skipped: true };
  }

  const garments = await loadGarmentCatalog();
  if (garments.length === 0) {
    return {
      ok: false,
      error: "Your closet is empty. Add garments before generating a weekly plan.",
      planId: row?.id,
    };
  }

  const validIds = new Set(garments.map((g) => g.id));
  const catalogText = formatClosetCatalog(garments);

  const settled = await Promise.allSettled(
    Array.from({ length: WEEKLY_DAYS }, (_, dayIndex) =>
      runStep1PlanWithRetry({
        lookCount: 1,
        climate,
        context,
        narrative,
        catalogText,
        validIds,
        weekly: true,
        weeklyDayIndex: dayIndex,
      }),
    ),
  );

  const plans: LookbookPlan[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]!;
    if (s.status === "rejected") {
      logServerError(`runWeeklyOutfitsJob step1 day ${i}`, s.reason);
      return {
        ok: false,
        error: WEEKLY_JOB_FAILED_PUBLIC,
        planId: row?.id,
      };
    }
    const plan = s.value;
    if (!plan.looks[0]) {
      return {
        ok: false,
        error: `Day ${i} returned no look.`,
        planId: row?.id,
      };
    }
    plans.push(plan);
  }

  const looksForDb = plans.map((p) => p.looks[0]!);
  const step1Raw = buildWeeklyStep1Raw(plans);

  let planId: string | undefined;

  try {
    if (row) {
      planId = row.id;
      await sql`DELETE FROM weekly_plan_looks WHERE plan_id = ${planId}`;
      await sql`
        UPDATE weekly_outfit_plans
        SET
          step1_raw = ${JSON.stringify(step1Raw)}::jsonb,
          status = 'draft',
          error_message = NULL,
          updated_at = now()
        WHERE id = ${planId}
      `;
    } else {
      const insertedRows = (await sql`
        INSERT INTO weekly_outfit_plans (week_start, step1_raw, status)
        VALUES (${input.weekStart}::date, ${JSON.stringify(step1Raw)}::jsonb, 'draft')
        RETURNING id
      `) as { id: string }[];
      planId = insertedRows[0]!.id;
    }

    for (let i = 0; i < looksForDb.length; i++) {
      const look = looksForDb[i]!;
      await sql`
        INSERT INTO weekly_plan_looks (
          plan_id,
          sort_order,
          title,
          description,
          tags,
          garment_ids
        )
        VALUES (
          ${planId},
          ${i},
          ${look.title},
          ${look.description},
          ${JSON.stringify(look.tags)}::jsonb,
          ${look.garmentIds ?? []}
        )
      `;
    }

    const heroOutcomes = await Promise.all(
      looksForDb.map(async (look, i) => {
        const ids = look.garmentIds ?? [];
        if (ids.length === 0) {
          return {
            i,
            url: null as string | null,
            missingGarments: true as const,
          };
        }
        const rows = await loadGarmentsByIds(ids);
        const idOrder = new Map(ids.map((id, j) => [id, j]));
        rows.sort(
          (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
        );
        try {
          const heroImage = await runHeroImageStep({
            title: look.title,
            description: look.description,
            climate,
            context,
            narrative,
            garments: rows.map((r) => ({
              id: r.id,
              category: r.category,
              name: r.name,
              imageUrl: r.image_url,
            })),
          });
          return { i, url: heroImage ?? null, missingGarments: false as const };
        } catch {
          return { i, url: null, missingGarments: false as const };
        }
      }),
    );

    const missing = heroOutcomes.find((o) => o.missingGarments);
    if (missing) {
      await markPlanFailed(
        planId,
        `Look sort_order=${missing.i} has no garment_ids; cannot render hero image.`,
      );
      return {
        ok: false,
        error: `Look ${missing.i} has no garment_ids`,
        planId,
      };
    }

    await Promise.all(
      heroOutcomes.map((o) =>
        sql`
          UPDATE weekly_plan_looks
          SET hero_image_url = ${o.url}
          WHERE plan_id = ${planId} AND sort_order = ${o.i}
        `,
      ),
    );

    await sql`
      UPDATE weekly_outfit_plans
      SET status = 'completed', updated_at = now(), error_message = NULL
      WHERE id = ${planId}
    `;

    return { ok: true, planId, skipped: false };
  } catch (e) {
    logServerError("runWeeklyOutfitsJob", e);
    if (planId) {
      await markPlanFailed(planId, WEEKLY_JOB_FAILED_PUBLIC);
    }
    return { ok: false, error: WEEKLY_JOB_FAILED_PUBLIC, planId };
  }
}
