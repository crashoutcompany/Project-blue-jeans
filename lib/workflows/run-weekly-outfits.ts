import { formatClosetCatalog } from "@/lib/ai/lookbook/catalog";
import type { AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { getWearerPhoto } from "@/lib/wearer/profile";
import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { requireSql } from "@/lib/db";
import {
  loadGarmentCatalog,
  loadGarmentsByIds,
} from "@/lib/garments/load-catalog";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import {
  availableGarments,
  closetCategories,
  exhaustedCategoriesAfterLook,
  lockLookGarments,
  todaySortOrder,
  weeklyDaysToPlan,
} from "@/lib/outfits/weekly-plan-catalog";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  addDaysIso,
  formatProductWeekday,
  productTodayIso,
} from "@/lib/time/product-timezone";
import type { WeeklyOutfitsInput } from "@/lib/workflows/types";
import { MAX_NARRATIVE_LEN } from "@/lib/garments/field-limits";
import { z } from "zod";

const WEEKLY_JOB_FAILED_PUBLIC =
  "Weekly outfits job failed. Check server logs for details.";

export type WeeklyOutfitsJobResult =
  | { ok: true; planId: string; skipped: true }
  | { ok: true; planId: string; skipped: false }
  | { ok: false; error: string; planId?: string };

const MAX_NARRATIVE = MAX_NARRATIVE_LEN;
const WEEK_LENGTH = 7;

const planStatusRowSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
});

const retainedLookRowSchema = z.object({
  sort_order: z.number().int(),
  title: z.string(),
  garment_ids: z.array(z.string()).nullable().optional(),
});

const insertedIdRowSchema = z.object({
  id: z.string().uuid(),
});

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
    source: "weekly_sequential_step1" as const,
    plans,
    curatorNote: curatorNote.length > 0 ? curatorNote : undefined,
  };
}

function garmentNamesForIds(
  ids: string[],
  byId: Map<string, { name: string | null }>,
): string[] {
  return ids.map((id) => byId.get(id)?.name?.trim() || "Untitled");
}

/**
 * Plan my week: sequential step-1 (shrinking catalog, Outfit locks, per-category
 * reuse when exhausted), then parallel hero-image calls.
 */
export async function runWeeklyOutfitsJob(
  input: WeeklyOutfitsInput,
  now = new Date(),
): Promise<WeeklyOutfitsJobResult> {
  const narrative = input.narrative.trim().slice(0, MAX_NARRATIVE);
  const climate = input.climate.trim().slice(0, 80);
  const context = input.context.trim().slice(0, 80);

  if (!climate || !context) {
    return { ok: false, error: "Climate and context are required." };
  }

  if (!input.userId) {
    return { ok: false, error: "Missing user id." };
  }

  const sql = requireSql();
  const todayIso = productTodayIso(now);
  const todaySort = todaySortOrder(input.weekStart, todayIso);
  const weekEnd = addDaysIso(input.weekStart, WEEK_LENGTH - 1);

  const existingRaw = await sql`
    SELECT id, status::text AS status
    FROM weekly_outfit_plans
    WHERE user_id = ${input.userId}
      AND week_start = ${input.weekStart}::date
    LIMIT 1
  `;
  const existingParsed = z.array(planStatusRowSchema).safeParse(existingRaw);
  const row = existingParsed.success ? existingParsed.data[0] : undefined;
  if (row?.status === "completed") {
    return { ok: true, planId: row.id, skipped: true };
  }

  const outfitRows = await loadOutfitsInRange(
    input.userId,
    input.weekStart,
    weekEnd,
  );
  const outfitWornOn = new Set(outfitRows.map((r) => r.wornOn));
  const outfitLockedIds = new Set<string>();
  for (const r of outfitRows) {
    for (const id of r.garmentIds) {
      outfitLockedIds.add(id);
    }
  }

  const daysToPlan = weeklyDaysToPlan(
    input.weekStart,
    todayIso,
    outfitWornOn,
  );
  if (daysToPlan.length === 0) {
    return { ok: true, planId: row?.id ?? "", skipped: true };
  }

  if (!hasGeminiCredentials()) {
    return {
      ok: false,
      error:
        "Missing Gemini credentials. Set GOOGLE_GENERATIVE_AI_API_KEY (see docs/gemini-ai-studio-env.md).",
      planId: row?.id,
    };
  }

  const garments = await loadGarmentCatalog(input.userId);
  if (garments.length === 0) {
    return {
      ok: false,
      error:
        "Your closet is empty. Add garments before generating a weekly plan.",
      planId: row?.id,
    };
  }

  const garmentsById = new Map(garments.map((g) => [g.id, g]));
  const closetHas = closetCategories(garments);
  const uniqueLockedIds = new Set<string>();
  let exhausted = new Set<string>();
  const alreadyPlanned: AlreadyPlannedLook[] = [];
  const plans: LookbookPlan[] = [];
  const looksForDb: {
    sortOrder: number;
    title: string;
    description: string;
    tags: string[];
    garmentIds: string[];
  }[] = [];

  if (row) {
    const retainedRaw = await sql`
      SELECT sort_order, title, garment_ids
      FROM weekly_plan_looks
      WHERE plan_id = ${row.id}
        AND sort_order < ${todaySort}
      ORDER BY sort_order
    `;
    const retainedParsed = z
      .array(retainedLookRowSchema)
      .safeParse(retainedRaw);
    const retainedRows = retainedParsed.success ? retainedParsed.data : [];

    for (const look of retainedRows) {
      const ids = Array.isArray(look.garment_ids)
        ? look.garment_ids.map(String)
        : [];
      alreadyPlanned.push({
        weekday: formatProductWeekday(
          addDaysIso(input.weekStart, look.sort_order),
        ),
        title: look.title,
        garmentNames: garmentNamesForIds(ids, garmentsById),
      });
      lockLookGarments(ids, outfitLockedIds, uniqueLockedIds);
    }
    exhausted = exhaustedCategoriesAfterLook(
      garments,
      outfitLockedIds,
      uniqueLockedIds,
      closetHas,
    );
  }

  try {
    for (const day of daysToPlan) {
      const available = availableGarments(
        garments,
        outfitLockedIds,
        uniqueLockedIds,
        exhausted,
      );
      if (available.length === 0) {
        return {
          ok: false,
          error:
            "Not enough unused clothes left in your closet to plan this week.",
          planId: row?.id,
        };
      }

      const validIds = new Set(available.map((g) => g.id));
      const plan = await runStep1PlanWithRetry({
        lookCount: 1,
        climate,
        context,
        narrative,
        catalogText: formatClosetCatalog(available),
        validIds,
        weekly: true,
        weeklyWeekday: day.weekday,
        alreadyPlanned: alreadyPlanned.slice(),
      });
      const look = plan.looks[0];
      if (!look) {
        return {
          ok: false,
          error: `Day ${day.weekday} returned no look.`,
          planId: row?.id,
        };
      }

      plans.push(plan);
      looksForDb.push({
        sortOrder: day.sortOrder,
        title: look.title,
        description: look.description,
        tags: look.tags,
        garmentIds: look.garmentIds ?? [],
      });
      alreadyPlanned.push({
        weekday: day.weekday,
        title: look.title,
        garmentNames: garmentNamesForIds(look.garmentIds ?? [], garmentsById),
      });
      lockLookGarments(look.garmentIds ?? [], outfitLockedIds, uniqueLockedIds);
      exhausted = exhaustedCategoriesAfterLook(
        garments,
        outfitLockedIds,
        uniqueLockedIds,
        closetHas,
      );
    }
  } catch (e) {
    logServerError("runWeeklyOutfitsJob step1", e);
    return {
      ok: false,
      error: WEEKLY_JOB_FAILED_PUBLIC,
      planId: row?.id,
    };
  }

  const step1Raw = buildWeeklyStep1Raw(plans);
  let planId: string | undefined;

  try {
    if (row) {
      planId = row.id;
      await sql`
        DELETE FROM weekly_plan_looks
        WHERE plan_id = ${planId}
          AND sort_order >= ${todaySort}
      `;
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
      const insertedRaw = await sql`
        INSERT INTO weekly_outfit_plans (week_start, step1_raw, status, user_id)
        VALUES (
          ${input.weekStart}::date,
          ${JSON.stringify(step1Raw)}::jsonb,
          'draft',
          ${input.userId}
        )
        RETURNING id
      `;
      const insertedParsed = z.array(insertedIdRowSchema).parse(insertedRaw);
      const insertedId = insertedParsed[0]?.id;
      if (!insertedId) {
        throw new Error("Insert weekly plan returned no id");
      }
      planId = insertedId;
    }

    for (const look of looksForDb) {
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
          ${look.sortOrder},
          ${look.title},
          ${look.description},
          ${JSON.stringify(look.tags)}::jsonb,
          ${look.garmentIds}
        )
      `;
    }

    const wearer = await getWearerPhoto(input.userId);
    const heroOutcomes = await Promise.all(
      looksForDb.map(async (look) => {
        const ids = look.garmentIds;
        if (ids.length === 0) {
          return {
            sortOrder: look.sortOrder,
            url: null as string | null,
            missingGarments: true as const,
          };
        }
        const rows = await loadGarmentsByIds(input.userId, ids);
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
            wearerPhotoUrl: wearer?.imageUrl,
          });
          return {
            sortOrder: look.sortOrder,
            url: heroImage ?? null,
            missingGarments: false as const,
          };
        } catch {
          return {
            sortOrder: look.sortOrder,
            url: null,
            missingGarments: false as const,
          };
        }
      }),
    );

    const missing = heroOutcomes.find((o) => o.missingGarments);
    if (missing) {
      await markPlanFailed(
        planId,
        `Look sort_order=${missing.sortOrder} has no garment_ids; cannot render hero image.`,
      );
      return {
        ok: false,
        error: `Look ${missing.sortOrder} has no garment_ids`,
        planId,
      };
    }

    await Promise.all(
      heroOutcomes.map(
        (o) =>
          sql`
          UPDATE weekly_plan_looks
          SET hero_image_url = ${o.url}
          WHERE plan_id = ${planId} AND sort_order = ${o.sortOrder}
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
