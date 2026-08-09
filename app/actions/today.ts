"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { assertAdminForServerAction } from "@/lib/auth/admin";
import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import { CALENDAR_MONTH_TAG } from "@/lib/outfits/calendar-month-cache-tag";
import { CLOSET_SAVED_OUTFITS_TAG } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import { approveWeeklyPlanLook } from "@/app/actions/outfits";
import {
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

function revalidateTodaySurfaces() {
  revalidateTag(CLOSET_SAVED_OUTFITS_TAG, "max");
  revalidateTag(CALENDAR_MONTH_TAG, "max");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/closet");
}

/**
 * Empty Today CTA — generate Weekly Fits for the current Sunday-start week.
 */
export async function planMyWeek(): Promise<
  { ok: true; skipped?: boolean } | { ok: false; message: string }
> {
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };

  const todayIso = productTodayIso();
  const weekStart = sundayWeekStartIso(todayIso);

  try {
    const result = await runWeeklyOutfitsJob({
      weekStart,
      climate: "Temperate",
      context: "Everyday week",
      narrative: "",
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidateTodaySurfaces();
    return { ok: true, skipped: result.skipped };
  } catch (e) {
    logServerError("planMyWeek", e);
    return {
      ok: false,
      message: "Could not plan your week. Try again in a moment.",
    };
  }
}

/**
 * Wear this — promote today’s Fit to an Outfit.
 */
export async function wearThisFit(
  planLookId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await approveWeeklyPlanLook(planLookId);
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true };
}

/**
 * Unwear — detach today’s Outfit. Removes Closet archive only if never worn
 * on another day (handled by deleting this day’s row; shared identity via
 * garment set is a later uniqueness pass).
 */
export async function unwearToday(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };

  const todayIso = productTodayIso();

  try {
    const sql = requireSql();
    await sql`
      DELETE FROM outfits
      WHERE worn_on = ${todayIso}::date
    `;
    revalidateTodaySurfaces();
    return { ok: true };
  } catch (e) {
    logServerError("unwearToday", e);
    return { ok: false, message: "Could not unwear today’s look." };
  }
}
