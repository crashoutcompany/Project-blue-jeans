import { cacheTag } from "next/cache";

import {
  CLOSET_GARMENTS_TAG,
  closetGarmentsTag,
} from "@/lib/garments/closet-garments-cache-tag";
import { getSql } from "@/lib/db";
import { garmentRowToCardData, type GarmentRow } from "@/lib/garments/map-row";
import type { ClothingCardData } from "@/lib/garments/types";

export { CLOSET_GARMENTS_TAG, closetGarmentsTag };

/**
 * Cached garment rows for one Wearer account.
 * Invalidate after writes with `revalidateTag(closetGarmentsTag(userId), ...)`.
 */
export async function getAllGarmentRowsCached(
  userId: string,
): Promise<GarmentRow[]> {
  "use cache";
  cacheTag(closetGarmentsTag(userId));

  const sql = getSql();
  if (!sql || !userId) return [];

  try {
    const rows = await sql`
      SELECT
        id,
        image_url,
        uploadthing_key,
        media_asset_id,
        category::text AS category,
        color,
        is_favorite,
        name,
        notes,
        description
      FROM garments
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return rows as GarmentRow[];
  } catch {
    console.error(
      "[garments] getAllGarmentRowsCached failed — did you run db/schema.sql / migrate-per-account.sql in Neon?",
    );
    return [];
  }
}

/**
 * Cached closet list for Cache Components.
 */
export async function getClosetGarmentsCached(
  userId: string,
): Promise<ClothingCardData[]> {
  const rows = await getAllGarmentRowsCached(userId);
  return rows.map(garmentRowToCardData);
}
