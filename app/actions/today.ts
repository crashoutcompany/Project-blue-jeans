"use server";

import { z } from "zod";

import { assertAdmittedForServerAction } from "@/lib/auth/admitted";
import { revalidateOutfitSurfaces } from "@/lib/cache/revalidate-wearer-surfaces";
import { logServerError } from "@/lib/server/safe-client-error";
import { unwearDay } from "@/lib/outfits/persist-generator-outfit";
import { approveWeeklyPlanLook } from "@/app/actions/outfits";
import { assertMutableWornOn } from "@/lib/time/mutable-calendar-day";
import {
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { regenerateWeeklyDay } from "@/lib/workflows/regenerate-weekly-day";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

const wornOnSchema = z.iso.date();

/** Same defaults as "Plan my week", so a regenerated day matches the rest. */
const WEEK_STYLE = {
  climate: "Temperate",
  context: "Everyday week",
  narrative: "",
} as const;

/**
 * Empty Today CTA — generate Weekly Fits for the current Sunday-start week.
 */
export async function planMyWeek(): Promise<
  { ok: true; skipped?: boolean } | { ok: false; message: string }
> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };

  const todayIso = productTodayIso();
  const weekStart = sundayWeekStartIso(todayIso);

  try {
    const result = await runWeeklyOutfitsJob({
      userId: gate.userId,
      weekStart,
      ...WEEK_STYLE,
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidateOutfitSurfaces(gate.userId);
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
 * Regenerate this day — replan one day of this week's Fits without touching
 * the other days.
 */
export async function regenerateDay(
  wornOn: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = wornOnSchema.safeParse(wornOn);
  if (!parsed.success) {
    return { ok: false, message: "Invalid date." };
  }

  try {
    const result = await regenerateWeeklyDay({
      userId: gate.userId,
      weekStart: sundayWeekStartIso(productTodayIso()),
      wornOn: parsed.data,
      ...WEEK_STYLE,
    });
    revalidateOutfitSurfaces(gate.userId);
    return result;
  } catch (e) {
    logServerError("regenerateDay", e);
    return {
      ok: false,
      message: "Could not regenerate this day. Try again in a moment.",
    };
  }
}

/**
 * Wear this — promote a Fit to an Outfit for that Fit’s calendar day.
 */
export async function wearThisFit(
  planLookId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await approveWeeklyPlanLook(planLookId);
  if (!result.ok) return result;
  return { ok: true };
}

/**
 * Unwear — detach an Outfit from a calendar day (today or future only).
 */
export async function unwearDayForUser(
  wornOn: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = wornOnSchema.safeParse(wornOn);
  if (!parsed.success) {
    return { ok: false, message: "Invalid date." };
  }

  const mutable = assertMutableWornOn(parsed.data);
  if (!mutable.ok) return mutable;

  const result = await unwearDay(gate.userId, parsed.data);
  if (!result.ok) return result;
  revalidateOutfitSurfaces(gate.userId);
  return { ok: true };
}
