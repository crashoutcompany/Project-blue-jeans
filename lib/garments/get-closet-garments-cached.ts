import { cacheTag } from "next/cache";

import { CLOSET_GARMENTS_TAG } from "@/lib/garments/closet-garments-cache-tag";
import { getSql } from "@/lib/db";
import { garmentRowToCardData, type GarmentRow } from "@/lib/garments/map-row";
import type { ClothingCardData } from "@/lib/garments/types";

export { CLOSET_GARMENTS_TAG };

/**
 * Single cached query for all garment rows. Shared by closet UI and AI catalog loaders.
 * Invalidate after writes with `updateTag` / `revalidateTag(CLOSET_GARMENTS_TAG, ...)`.
 */
export async function getAllGarmentRowsCached(): Promise<GarmentRow[]> {
  "use cache";
  cacheTag(CLOSET_GARMENTS_TAG);

  const sql = getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT
        id,
        image_url,
        uploadthing_key,
        category::text AS category,
        color,
        is_favorite,
        name,
        notes,
        description
      FROM garments
      ORDER BY created_at DESC
    `;

    return rows as GarmentRow[];
  } catch {
    console.error(
      "[garments] getAllGarmentRowsCached failed — did you run db/schema.sql in Neon?",
    );
    return [];
  }
}

/**
 * Cached closet list for Cache Components.
 */
export async function getClosetGarmentsCached(): Promise<ClothingCardData[]> {
  const rows = await getAllGarmentRowsCached();
  return rows.map(garmentRowToCardData);
}
