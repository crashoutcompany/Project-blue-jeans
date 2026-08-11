"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { assertAdminForServerAction } from "@/lib/auth/admin";
import { logServerError } from "@/lib/server/safe-client-error";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import { unwearDay } from "@/lib/outfits/persist-generator-outfit";
import { approveWeeklyPlanLook } from "@/app/actions/outfits";
import {
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

function revalidateTodaySurfaces(userId: string) {
  revalidateTag(closetSavedOutfitsTag(userId), "max");
  revalidateTag(calendarMonthTag(userId), "max");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/closet");
}

const wornOnSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
      userId: gate.userId,
      weekStart,
      climate: "Temperate",
      context: "Everyday week",
      narrative: "",
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidateTodaySurfaces(gate.userId);
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
 * Wear this — promote a Fit to an Outfit for that Fit’s calendar day.
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
 * Unwear — detach an Outfit from a calendar day (today or future only).
 */
export async function unwearDayForUser(
  wornOn: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = wornOnSchema.safeParse(wornOn);
  if (!parsed.success) {
    return { ok: false, message: "Invalid date." };
  }

  const todayIso = productTodayIso();
  if (parsed.data < todayIso) {
    return { ok: false, message: "Past looks can’t be changed." };
  }

  const result = await unwearDay(gate.userId, parsed.data);
  if (!result.ok) return result;
  revalidateTodaySurfaces(gate.userId);
  return { ok: true };
}
