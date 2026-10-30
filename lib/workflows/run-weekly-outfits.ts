import type { AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";
import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { loadGarmentCatalog } from "@/lib/garments/load-catalog";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import {
  lockLookTops,
  todaySortOrder,
  weeklyDaysToPlan,
} from "@/lib/outfits/weekly-plan-catalog";
import type { FailedPlanDay } from "@/lib/outfits/weekly-plan-failures";
import { categoryByIdFromCatalog } from "@/lib/outfits/look-composition";
import { getWearerLocation } from "@/lib/wearer/preferences";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  addDaysIso,
  formatProductWeekday,
  productTodayIso,
} from "@/lib/time/product-timezone";
import type { WeeklyOutfitsInput } from "@/lib/workflows/types";
import {
  WEEK_ALREADY_PLANNING_PUBLIC,
  withWeekClaim,
} from "@/lib/workflows/weekly-plan-claim";
import {
  garmentNamesForIds,
  planWeeklyDay,
  renderWeeklyLookHeroes,
  type WeeklyLook,
  type WeeklyStyleInput,
} from "@/lib/workflows/weekly-plan-day";
import { MAX_NARRATIVE_LEN } from "@/lib/garments/field-limits";
import { resolveOutfitLocation } from "@/lib/ai/weather/constants";
import { z } from "zod";

const WEEKLY_JOB_FAILED_PUBLIC =
  "Weekly outfits job failed. Check server logs for details.";

export type WeeklyOutfitsJobResult =
  | { ok: true; planId: string; skipped: true }
  | {
      ok: true;
      planId: string;
      skipped: false;
      /** Days that could not be planned; the rest of the week was saved. */
      failedDays: FailedPlanDay[];
    }
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

function buildWeeklyStep1Raw(
  plans: LookbookPlan[],
  failedDays: FailedPlanDay[],
) {
  const curatorNote = plans
    .map((p) => p.curatorNote?.trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    source: "weekly_sequential_step1" as const,
    plans,
    curatorNote: curatorNote.length > 0 ? curatorNote : undefined,
    failedDays,
  };
}

/**
 * Plan my week: sequential step-1 (tops stay unique; bottoms, shoes,
 * repeat), then bounded hero-image calls. A day the model cannot plan is
 * recorded in `step1_raw.failedDays` and the other days still save.
 */
export async function runWeeklyOutfitsJob(
  input: WeeklyOutfitsInput,
  now = new Date(),
): Promise<WeeklyOutfitsJobResult> {
  if (!input.userId) {
    return { ok: false, error: "Missing user id." };
  }

  const claimed = await withWeekClaim(
    input.userId,
    input.weekStart,
    "runWeeklyOutfitsJob",
    () => planClaimedWeek(input, now),
  );
  if (claimed.busy) {
    return { ok: false, error: WEEK_ALREADY_PLANNING_PUBLIC };
  }
  return claimed.value;
}

async function planClaimedWeek(
  input: WeeklyOutfitsInput,
  now: Date,
): Promise<WeeklyOutfitsJobResult> {
  const narrative = input.narrative.trim().slice(0, MAX_NARRATIVE);
  const climate = input.climate.trim().slice(0, 80);
  const context = input.context.trim().slice(0, 80);

  if (!climate || !context) {
    return { ok: false, error: "Climate and context are required." };
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

  let outfitRows: Awaited<ReturnType<typeof loadOutfitsInRange>>;
  try {
    outfitRows = await loadOutfitsInRange(
      input.userId,
      input.weekStart,
      weekEnd,
      { onError: "throw" },
    );
  } catch {
    return {
      ok: false,
      error: WEEKLY_JOB_FAILED_PUBLIC,
      planId: row?.id,
    };
  }
  const outfitWornOn = new Set(outfitRows.map((r) => r.wornOn));

  const daysToPlan = weeklyDaysToPlan(
    input.weekStart,
    todayIso,
    outfitWornOn,
  );
  if (daysToPlan.length === 0) {
    return { ok: true, planId: row?.id ?? "", skipped: true };
  }

  const gemini = await resolveGeminiApiKey(input.userId);
  if (!gemini.ok) {
    return {
      ok: false,
      error: gemini.message,
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
  const categoryById = categoryByIdFromCatalog(garments);
  const lockedTopIds = new Set<string>();
  for (const r of outfitRows) {
    lockLookTops(r.garmentIds, categoryById, lockedTopIds);
  }
  const alreadyPlanned: AlreadyPlannedLook[] = [];
  const plans: LookbookPlan[] = [];
  const looksForDb: WeeklyLook[] = [];
  const failedDays: FailedPlanDay[] = [];

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
      lockLookTops(ids, categoryById, lockedTopIds);
    }
  }

  const style: WeeklyStyleInput = {
    apiKey: gemini.apiKey,
    climate,
    context,
    narrative,
    location: resolveOutfitLocation(
      input.location?.trim()
        ? input.location
        : await getWearerLocation(input.userId),
    ),
  };

  for (const day of daysToPlan) {
    const result = await planWeeklyDay(
      style,
      day,
      garments,
      categoryById,
      lockedTopIds,
      alreadyPlanned,
    );
    if (result.status === "closet-exhausted") {
      if (looksForDb.length === 0 && failedDays.length === 0) {
        return {
          ok: false,
          error:
            "Need a top, bottom, and shoes still available to finish the week. Add clothes or Change look on a day.",
          planId: row?.id,
        };
      }
      break;
    }
    if (result.status === "failed") {
      logServerError(
        `runWeeklyOutfitsJob step1 day=${day.weekday} garments=${result.garmentCount} plannedDays=${looksForDb.length}`,
        result.error,
      );
      failedDays.push({ sortOrder: day.sortOrder, message: result.message });
      continue;
    }

    const { plan, look } = result;
    plans.push(plan);
    looksForDb.push(look);
    alreadyPlanned.push({
      weekday: day.weekday,
      title: look.title,
      garmentNames: garmentNamesForIds(look.garmentIds, garmentsById),
    });
    lockLookTops(look.garmentIds, categoryById, lockedTopIds);
  }

  // Nothing planned: keep any earlier plan untouched and name the first
  // failed day, as before partial weeks existed.
  if (looksForDb.length === 0) {
    return {
      ok: false,
      error: failedDays[0]?.message ?? WEEKLY_JOB_FAILED_PUBLIC,
      planId: row?.id,
    };
  }

  const step1Raw = buildWeeklyStep1Raw(plans, failedDays);
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

    const heroOutcomes = await renderWeeklyLookHeroes(
      input.userId,
      style,
      looksForDb,
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

    return { ok: true, planId, skipped: false, failedDays };
  } catch (e) {
    logServerError("runWeeklyOutfitsJob", e);
    if (planId) {
      await markPlanFailed(planId, WEEKLY_JOB_FAILED_PUBLIC);
    }
    return { ok: false, error: WEEKLY_JOB_FAILED_PUBLIC, planId };
  }
}
