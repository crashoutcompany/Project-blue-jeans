import type { AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import { resolveOutfitLocation } from "@/lib/ai/weather/constants";
import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { loadGarmentCatalog } from "@/lib/garments/load-catalog";
import { MAX_NARRATIVE_LEN } from "@/lib/garments/field-limits";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import { categoryByIdFromCatalog } from "@/lib/outfits/look-composition";
import { lockLookTops } from "@/lib/outfits/weekly-plan-catalog";
import {
  parseFailedPlanDays,
  withFailedPlanDay,
  type FailedPlanDay,
} from "@/lib/outfits/weekly-plan-failures";
import { logServerError } from "@/lib/server/safe-client-error";
import { getWearerLocation } from "@/lib/wearer/preferences";
import { assertMutableWornOn } from "@/lib/time/mutable-calendar-day";
import {
  addDaysIso,
  formatProductWeekday,
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
  type WeeklyStyleInput,
} from "@/lib/workflows/weekly-plan-day";
import { z } from "zod";

export type RegenerateWeeklyDayInput = WeeklyOutfitsInput & {
  /** Calendar day to replan (YYYY-MM-DD) inside `weekStart`'s week. */
  wornOn: string;
};

export type RegenerateWeeklyDayResult =
  | { ok: true }
  | { ok: false; message: string };

const WEEK_LENGTH = 7;

const REGENERATE_FAILED_PUBLIC =
  "Could not regenerate this day. Try again in a moment.";

const planRowSchema = z.object({
  id: z.string().uuid(),
  step1_raw: z.unknown(),
});

const planLookRowSchema = z.object({
  sort_order: z.number().int(),
  title: z.string(),
  garment_ids: z.array(z.string()).nullable().optional(),
});

function sortOrderInWeek(weekStart: string, wornOn: string): number | null {
  for (let i = 0; i < WEEK_LENGTH; i++) {
    if (addDaysIso(weekStart, i) === wornOn) return i;
  }
  return null;
}

/**
 * Regenerate this day: replan one day of the week's Fits. The other days'
 * Fits and Outfits stay as they are; their tops stay locked so the new look
 * does not repeat them.
 */
export async function regenerateWeeklyDay(
  input: RegenerateWeeklyDayInput,
  now = new Date(),
): Promise<RegenerateWeeklyDayResult> {
  if (!input.userId) return { ok: false, message: "Missing user id." };

  const sortOrder = sortOrderInWeek(input.weekStart, input.wornOn);
  if (sortOrder === null) {
    return { ok: false, message: "That day is not in this week." };
  }
  const mutable = assertMutableWornOn(input.wornOn, now);
  if (!mutable.ok) return mutable;

  const claimed = await withWeekClaim(
    input.userId,
    input.weekStart,
    "regenerateWeeklyDay",
    async () => {
      try {
        return await regenerateClaimedDay(input, sortOrder);
      } catch (e) {
        logServerError("regenerateWeeklyDay", e);
        return { ok: false as const, message: REGENERATE_FAILED_PUBLIC };
      }
    },
  );
  if (claimed.busy) return { ok: false, message: WEEK_ALREADY_PLANNING_PUBLIC };
  return claimed.value;
}

async function regenerateClaimedDay(
  input: RegenerateWeeklyDayInput,
  sortOrder: number,
): Promise<RegenerateWeeklyDayResult> {
  const sql = requireSql();
  const weekday = formatProductWeekday(input.wornOn);

  const planRaw = await sql`
    SELECT id, step1_raw
    FROM weekly_outfit_plans
    WHERE user_id = ${input.userId}
      AND week_start = ${input.weekStart}::date
      AND status IN ('completed', 'draft')
    LIMIT 1
  `;
  const plan = z.array(planRowSchema).parse(planRaw)[0];
  if (!plan) {
    return { ok: false, message: "Plan your week first." };
  }

  const outfitRows = await loadOutfitsInRange(
    input.userId,
    input.weekStart,
    addDaysIso(input.weekStart, WEEK_LENGTH - 1),
    { onError: "throw" },
  );
  if (outfitRows.some((r) => r.wornOn === input.wornOn)) {
    return {
      ok: false,
      message: "This day already has an Outfit. Unwear it to plan a new look.",
    };
  }

  const gemini = await resolveGeminiApiKey(input.userId);
  if (!gemini.ok) return { ok: false, message: gemini.message };

  const garments = await loadGarmentCatalog(input.userId);
  if (garments.length === 0) {
    return {
      ok: false,
      message: "Your closet is empty. Add garments before planning a day.",
    };
  }

  const lookRows = z.array(planLookRowSchema).parse(
    await sql`
      SELECT sort_order, title, garment_ids
      FROM weekly_plan_looks
      WHERE plan_id = ${plan.id}
      ORDER BY sort_order
    `,
  );
  const hadLook = lookRows.some((r) => r.sort_order === sortOrder);

  const garmentsById = new Map(garments.map((g) => [g.id, g]));
  const categoryById = categoryByIdFromCatalog(garments);
  const lockedTopIds = new Set<string>();
  for (const r of outfitRows) {
    lockLookTops(r.garmentIds, categoryById, lockedTopIds);
  }
  const alreadyPlanned: AlreadyPlannedLook[] = [];
  for (const r of lookRows) {
    if (r.sort_order === sortOrder) continue;
    const ids = r.garment_ids ?? [];
    alreadyPlanned.push({
      weekday: formatProductWeekday(addDaysIso(input.weekStart, r.sort_order)),
      title: r.title,
      garmentNames: garmentNamesForIds(ids, garmentsById),
    });
    lockLookTops(ids, categoryById, lockedTopIds);
  }

  const style: WeeklyStyleInput = {
    apiKey: gemini.apiKey,
    climate: input.climate.trim().slice(0, 80),
    context: input.context.trim().slice(0, 80),
    narrative: input.narrative.trim().slice(0, MAX_NARRATIVE_LEN),
    location: resolveOutfitLocation(
      input.location?.trim()
        ? input.location
        : await getWearerLocation(input.userId),
    ),
  };

  const result = await planWeeklyDay(
    style,
    { iso: input.wornOn, sortOrder, weekday },
    garments,
    categoryById,
    lockedTopIds,
    alreadyPlanned,
  );

  const failedDays = parseFailedPlanDays(plan.step1_raw);
  if (result.status === "closet-exhausted") {
    return {
      ok: false,
      message: `Couldn't plan ${weekday}. Every top is already used this week. Add clothes or Change look on another day.`,
    };
  }
  if (result.status === "failed") {
    logServerError(
      `regenerateWeeklyDay step1 day=${weekday} garments=${result.garmentCount}`,
      result.error,
    );
    // A day that still shows its old Fit keeps it; only an empty day
    // carries the error on Today.
    if (!hadLook) {
      await saveFailedDays(
        plan.id,
        withFailedPlanDay(failedDays, sortOrder, result.message),
      );
    }
    return { ok: false, message: result.message };
  }

  const { look } = result;
  const [hero] = await renderWeeklyLookHeroes(input.userId, style, [look]);
  await sql`
    INSERT INTO weekly_plan_looks (
      plan_id,
      sort_order,
      title,
      description,
      tags,
      garment_ids,
      hero_image_url
    )
    VALUES (
      ${plan.id},
      ${look.sortOrder},
      ${look.title},
      ${look.description},
      ${JSON.stringify(look.tags)}::jsonb,
      ${look.garmentIds},
      ${hero?.url ?? null}
    )
    ON CONFLICT (plan_id, sort_order) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      tags = EXCLUDED.tags,
      garment_ids = EXCLUDED.garment_ids,
      hero_image_url = EXCLUDED.hero_image_url
  `;
  await saveFailedDays(plan.id, withFailedPlanDay(failedDays, sortOrder, null));
  return { ok: true };
}

async function saveFailedDays(
  planId: string,
  failedDays: FailedPlanDay[],
): Promise<void> {
  const sql = requireSql();
  await sql`
    UPDATE weekly_outfit_plans
    SET
      step1_raw = jsonb_set(
        coalesce(step1_raw, '{}'::jsonb),
        '{failedDays}',
        ${JSON.stringify(failedDays)}::jsonb
      ),
      updated_at = now()
    WHERE id = ${planId}
  `;
}
