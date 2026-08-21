import { z } from "zod";

import { getSql } from "@/lib/db";
import { garmentSetKey } from "@/lib/outfits/garment-set-key";
import { logServerError } from "@/lib/server/safe-client-error";

const heroRowSchema = z.object({
  garment_set_key: z.string().min(1),
  image_url: z.string().min(1),
});

/**
 * Stored hero URLs for garment sets that already exist as committed Outfits.
 * Looks without a stored image are omitted so callers still generate a hero.
 */
export async function findExistingOutfitHeroUrls(
  userId: string,
  garmentIdLists: ReadonlyArray<readonly string[]>,
): Promise<Map<string, string>> {
  const heroes = new Map<string, string>();
  if (!userId) return heroes;

  const keys = [
    ...new Set(
      garmentIdLists
        .map((ids) => garmentSetKey([...ids]))
        .filter((key) => key.length > 0),
    ),
  ];
  if (keys.length === 0) return heroes;

  const sql = getSql();
  if (!sql) return heroes;

  try {
    const rows = await sql`
      SELECT garment_set_key, image_url
      FROM outfits
      WHERE user_id = ${userId}
        AND garment_set_key = ANY(${keys})
        AND image_url IS NOT NULL
        AND image_url <> ''
    `;
    const parsed = z.array(heroRowSchema).safeParse(rows);
    if (!parsed.success) return heroes;
    for (const row of parsed.data) {
      if (!heroes.has(row.garment_set_key)) {
        heroes.set(row.garment_set_key, row.image_url);
      }
    }
    return heroes;
  } catch (e) {
    logServerError("findExistingOutfitHeroUrls", e);
    return heroes;
  }
}

export function existingHeroForGarments(
  heroes: ReadonlyMap<string, string>,
  garmentIds: readonly string[] | undefined,
): string | undefined {
  const key = garmentSetKey([...(garmentIds ?? [])]);
  if (!key) return undefined;
  return heroes.get(key);
}
