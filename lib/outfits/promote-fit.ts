import { z } from "zod";

import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  assertGarmentsOwnedByUser,
  commitOutfitForDay,
  normalizeCommitImageUrl,
  type ApproveOutfitResult,
} from "@/lib/outfits/persist-generator-outfit";
import { assertMutableWornOn } from "@/lib/time/mutable-calendar-day";

const planLookRowSchema = z.object({
  id: z.string().uuid(),
  hero_image_url: z.string().nullable(),
  garment_ids: z.array(z.string()).nullable().optional(),
  worn_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Promote a Weekly Fit (plan look) to a committed Outfit for that calendar day.
 */
export async function promoteWeeklyFitToOutfit(
  userId: string,
  planLookId: string,
): Promise<ApproveOutfitResult> {
  try {
    const sql = requireSql();
    const rows = await sql`
      SELECT
        l.id,
        l.hero_image_url,
        l.garment_ids,
        (p.week_start + l.sort_order)::text AS worn_on
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE l.id = ${planLookId}::uuid
        AND p.user_id = ${userId}
      LIMIT 1
    `;
    const parsed = z.array(planLookRowSchema).safeParse(rows);
    const row = parsed.success ? parsed.data[0] : undefined;
    if (!row) {
      return { ok: false, message: "That weekly look was not found." };
    }

    const mutable = assertMutableWornOn(row.worn_on);
    if (!mutable.ok) return mutable;

    const garmentIds = Array.isArray(row.garment_ids)
      ? [...new Set(row.garment_ids)]
      : [];
    const ownership = await assertGarmentsOwnedByUser(userId, garmentIds);
    if (ownership) return ownership;

    const outfitId = await commitOutfitForDay({
      userId,
      wornOn: row.worn_on,
      garmentIds,
      imageUrl: normalizeCommitImageUrl(row.hero_image_url),
      occasion: "casual",
    });

    return { ok: true, outfitId };
  } catch (e) {
    logServerError("promoteWeeklyFitToOutfit", e);
    return {
      ok: false,
      message: "Could not approve this look. Try again.",
    };
  }
}
