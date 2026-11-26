import { cacheTag } from "next/cache";
import { z } from "zod";

import { getSql } from "@/lib/db";
import type { ClothingCardData } from "@/lib/garments/types";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";

/** Garment id → number of days the Wearer tapped "Wore this" on it. */
export type GarmentWearCounts = Record<string, number>;

const wearCountRowSchema = z.object({
  garment_id: z.string(),
  wear_count: z.coerce.number().int().nonnegative(),
});

/**
 * Wear count per Garment for one Wearer: confirmed ("Wore this") days whose
 * Outfit includes the piece. Committed-but-unconfirmed days do not count.
 * Pieces never worn are absent (read them as 0).
 *
 * Cached under the Closet Outfits tag, which every wear change
 * (Wore this, Unwear, commit) already revalidates.
 */
export async function loadGarmentWearCounts(
  userId: string,
): Promise<GarmentWearCounts> {
  "use cache";
  cacheTag(closetSavedOutfitsTag(userId));

  const sql = getSql();
  if (!sql || !userId) return {};

  try {
    const rows = await sql`
      SELECT
        og.garment_id::text AS garment_id,
        count(*)::int AS wear_count
      FROM outfit_wears w
      INNER JOIN outfits o
        ON o.id = w.outfit_id
       AND o.user_id = ${userId}
      INNER JOIN outfit_garments og ON og.outfit_id = o.id
      WHERE w.user_id = ${userId}
        AND w.worn_confirmed_at IS NOT NULL
      GROUP BY og.garment_id
    `;
    const counts: GarmentWearCounts = {};
    for (const row of z.array(wearCountRowSchema).parse(rows)) {
      counts[row.garment_id] = row.wear_count;
    }
    return counts;
  } catch (e) {
    // Rethrow: an empty result returned here would be cached as "never worn".
    console.error("[garments] loadGarmentWearCounts failed", e);
    throw e;
  }
}

/** Attach wear counts to closet cards (missing = never worn = 0). */
export function withWearCounts(
  garments: ClothingCardData[],
  counts: GarmentWearCounts,
): ClothingCardData[] {
  return garments.map((g) => ({ ...g, wearCount: counts[g.id] ?? 0 }));
}
