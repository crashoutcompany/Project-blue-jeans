import { cacheTag } from "next/cache";

import { getSql } from "@/lib/db";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";

export type ClosetSavedOutfit = {
  id: string;
  /** Last worn calendar day (YYYY-MM-DD). */
  wornOn: string;
  imageUrl: string | null;
  /** First linked garment image when `image_url` is null. */
  fallbackGarmentImageUrl: string | null;
  name: string | null;
  occasion: string;
  garmentIds: string[];
};

const DEFAULT_LIMIT = 48;

/**
 * Unique Closet → Outfits archive for one Wearer account.
 */
export async function loadSavedOutfitsForCloset(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<ClosetSavedOutfit[]> {
  "use cache";
  cacheTag(closetSavedOutfitsTag(userId));

  const sql = getSql();
  if (!sql || !userId) return [];

  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));

  try {
    const rows = (await sql`
      SELECT
        o.id,
        coalesce(max(w.worn_on), o.worn_on)::text AS last_worn,
        o.image_url,
        o.name,
        o.occasion::text AS occasion,
        (
          SELECT g.image_url
          FROM outfit_garments og
          INNER JOIN garments g ON g.id = og.garment_id
          WHERE og.outfit_id = o.id
          ORDER BY og.sort_order ASC, g.created_at ASC
          LIMIT 1
        ) AS fallback_garment_image_url,
        coalesce(
          (
            SELECT array_agg(og.garment_id::text ORDER BY og.sort_order)
            FROM outfit_garments og
            WHERE og.outfit_id = o.id
          ),
          '{}'
        ) AS garment_ids
      FROM outfits o
      INNER JOIN outfit_wears w
        ON w.outfit_id = o.id
       AND w.user_id = ${userId}
      WHERE o.user_id = ${userId}
      GROUP BY o.id
      ORDER BY max(w.worn_on) DESC, o.created_at DESC
      LIMIT ${safeLimit}
    `) as {
      id: string;
      last_worn: string;
      image_url: string | null;
      name: string | null;
      occasion: string;
      fallback_garment_image_url: string | null;
      garment_ids: string[] | null;
    }[];

    return rows.map((r) => ({
      id: r.id,
      wornOn: r.last_worn,
      imageUrl: r.image_url,
      fallbackGarmentImageUrl: r.fallback_garment_image_url,
      name: r.name,
      occasion: r.occasion,
      garmentIds: Array.isArray(r.garment_ids) ? r.garment_ids : [],
    }));
  } catch (e) {
    console.error("[outfits] loadSavedOutfitsForCloset failed", e);
    return [];
  }
}
