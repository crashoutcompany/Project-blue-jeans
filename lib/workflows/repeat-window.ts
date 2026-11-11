import { loadConfirmedWearsSince } from "@/lib/outfits/recent-wears";
import { repeatWindowStartIso } from "@/lib/outfits/repeat-guard";
import { logServerError } from "@/lib/server/safe-client-error";
import { getRepeatWindowDays } from "@/lib/wearer/preferences";
import type { RepeatWindowInput } from "@/lib/workflows/weekly-plan-day";

/**
 * The Wearer's repeat window plus every wear that can still block a day from
 * `todayIso` on. A failed read plans without the guard instead of failing
 * the week.
 */
export async function loadRepeatWindow(
  userId: string,
  todayIso: string,
): Promise<RepeatWindowInput> {
  const windowDays = await getRepeatWindowDays(userId);
  if (windowDays <= 0) return { wears: [], windowDays };
  try {
    const wears = await loadConfirmedWearsSince(
      userId,
      repeatWindowStartIso(todayIso, windowDays),
    );
    return { wears, windowDays };
  } catch (e) {
    logServerError("loadRepeatWindow", e);
    return { wears: [], windowDays };
  }
}
