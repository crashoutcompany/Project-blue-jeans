import { getSql } from "@/lib/db";

export type ClosetSavedOutfit = {
  id: string;
  wornOn: string;
  imageUrl: string | null;
  /** First linked garment image when `image_url` is null. */
  fallbackGarmentImageUrl: string | null;
  name: string | null;
  occasion: string;
};

const DEFAULT_LIMIT = 48;

/**
 * Recent rows from `outfits` for the closet archive section.
 * Hero `image_url` is preferred; otherwise the first garment image by `sort_order`.
 */
export async function loadSavedOutfitsForCloset(
  limit = DEFAULT_LIMIT,
): Promise<ClosetSavedOutfit[]> {
  const sql = getSql();
  if (!sql) return [];

  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));

  try {
    const rows = (await sql`
      SELECT
        o.id,
        o.worn_on::text AS worn_on,
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
        ) AS fallback_garment_image_url
      FROM outfits o
      ORDER BY o.worn_on DESC, o.created_at DESC
      LIMIT ${safeLimit}
    `) as {
      id: string;
      worn_on: string;
      image_url: string | null;
      name: string | null;
      occasion: string;
      fallback_garment_image_url: string | null;
    }[];

    console.log(rows);

    return rows.map((r) => ({
      id: r.id,
      wornOn: r.worn_on,
      imageUrl: r.image_url,
      fallbackGarmentImageUrl: r.fallback_garment_image_url,
      name: r.name,
      occasion: r.occasion,
    }));
  } catch (e) {
    console.error("[outfits] loadSavedOutfitsForCloset failed", e);
    return [];
  }
}
