import { unstable_cache } from "next/cache";

import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import { requireSql } from "@/lib/db";
import {
  closetGarmentsTag,
} from "@/lib/garments/closet-garments-cache-tag";
import { getAllGarmentRowsCached } from "@/lib/garments/get-closet-garments-cached";

/**
 * Closet rows formatted for step-1 AI catalog (same cache as `getClosetGarmentsCached`).
 */
export async function loadGarmentCatalog(
  userId: string,
): Promise<CatalogGarment[]> {
  const rows = await getAllGarmentRowsCached(userId);
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    color: r.color,
    notes: r.notes,
    description: r.description,
  }));
}

export type GarmentRowForImage = {
  id: string;
  category: string;
  name: string | null;
  image_url: string;
};

async function fetchGarmentsByIdsUncached(
  userId: string,
  sortedUniqueIds: string[],
): Promise<GarmentRowForImage[]> {
  const sql = requireSql();
  const rows = await sql`
    SELECT id, category::text AS category, name, image_url
    FROM garments
    WHERE user_id = ${userId}
      AND id = ANY(${sortedUniqueIds})
  `;
  return rows as GarmentRowForImage[];
}

/**
 * By-id fetch scoped to a Wearer account.
 */
export async function loadGarmentsByIds(
  userId: string,
  ids: string[],
): Promise<GarmentRowForImage[]> {
  if (ids.length === 0 || !userId) return [];

  const sortedUniqueIds = [...new Set(ids)].sort();
  const key = sortedUniqueIds.join(",");

  return unstable_cache(
    () => fetchGarmentsByIdsUncached(userId, sortedUniqueIds),
    ["garments-by-ids", userId, key],
    {
      tags: [closetGarmentsTag(userId)],
      revalidate: false,
    },
  )();
}
