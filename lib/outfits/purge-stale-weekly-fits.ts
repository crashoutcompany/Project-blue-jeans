import { z } from "zod";

import { getSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";

const deletedRowSchema = z.object({
  user_id: z.string().min(1),
});

export type PurgeStaleWeeklyFitsResult =
  | { ok: true; deletedPlans: number; userIds: string[] }
  | { ok: false; message: string };

/**
 * Drop Weekly Fits (plans + looks) whose Sunday week_start is before the
 * current product week. Committed Outfits / wears are not touched — those
 * live in `outfits` / `outfit_wears` after Approve / Wear this.
 */
export async function purgeStaleWeeklyFits(
  now = new Date(),
): Promise<PurgeStaleWeeklyFitsResult> {
  const sql = getSql();
  if (!sql) {
    return { ok: false, message: "DATABASE_URL is not configured" };
  }

  const currentWeekStart = sundayWeekStartIso(productTodayIso(now));

  try {
    const rows = await sql`
      DELETE FROM weekly_outfit_plans
      WHERE week_start < ${currentWeekStart}::date
      RETURNING user_id
    `;
    const parsed = z.array(deletedRowSchema).safeParse(rows);
    const userIds = parsed.success
      ? [...new Set(parsed.data.map((row) => row.user_id))]
      : [];
    const deletedPlans = parsed.success ? parsed.data.length : 0;
    return { ok: true, deletedPlans, userIds };
  } catch (e) {
    logServerError("purgeStaleWeeklyFits", e);
    return {
      ok: false,
      message: "Could not purge leftover weekly Fits.",
    };
  }
}
