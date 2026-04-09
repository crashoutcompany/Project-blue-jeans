import { unstable_cache } from "next/cache";

import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import { requireSql } from "@/lib/db";
import { CLOSET_GARMENTS_TAG, getAllGarmentRowsCached } from "@/lib/garments/get-closet-garments-cached";

/**
 * Closet rows formatted for step-1 AI catalog (same cache as `getClosetGarmentsCached`).
 */
export async function loadGarmentCatalog(): Promise<CatalogGarment[]> {
  const rows = await getAllGarmentRowsCached();
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
  sortedUniqueIds: string[],
): Promise<GarmentRowForImage[]> {
  const sql = requireSql();
  const rows = await sql`
    SELECT id, category::text AS category, name, image_url
    FROM garments
    WHERE id = ANY(${sortedUniqueIds})
  `;
  return rows as GarmentRowForImage[];
}

/**
 * By-id fetch with cross-request cache, tagged like the full closet list so
 * `revalidateTag` / `updateTag(CLOSET_GARMENTS_TAG)` keeps hero / batch image steps fresh.
 */
export async function loadGarmentsByIds(
  ids: string[],
): Promise<GarmentRowForImage[]> {
  if (ids.length === 0) return [];

  const sortedUniqueIds = [...new Set(ids)].sort();
  const key = sortedUniqueIds.join(",");

  return unstable_cache(
    () => fetchGarmentsByIdsUncached(sortedUniqueIds),
    ["garments-by-ids", key],
    {
      tags: [CLOSET_GARMENTS_TAG],
      revalidate: false,
    },
  )();
}
