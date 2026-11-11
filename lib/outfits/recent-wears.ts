import { z } from "zod";

import { getSql } from "@/lib/db";
import type { RecentWear } from "@/lib/outfits/repeat-guard";

const wearRowSchema = z.object({
  worn_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  garment_ids: z.array(z.string()).nullable().optional(),
});

/**
 * Days since `sinceIso` the Wearer confirmed with "Wore this", newest first.
 * Committed-but-unconfirmed days are not wears.
 */
export async function loadConfirmedWearsSince(
  userId: string,
  sinceIso: string,
): Promise<RecentWear[]> {
  const sql = getSql();
  if (!sql || !userId) return [];
  const rows = await sql`
    SELECT
      w.worn_on::text AS worn_on,
      coalesce(
        array_agg(og.garment_id::text ORDER BY og.sort_order)
          FILTER (WHERE og.garment_id IS NOT NULL),
        '{}'
      ) AS garment_ids
    FROM outfit_wears w
    INNER JOIN outfits o ON o.id = w.outfit_id
    LEFT JOIN outfit_garments og ON og.outfit_id = o.id
    WHERE w.user_id = ${userId}
      AND o.user_id = ${userId}
      AND w.worn_confirmed_at IS NOT NULL
      AND w.worn_on >= ${sinceIso}::date
    GROUP BY w.worn_on, o.id
    ORDER BY w.worn_on DESC
  `;
  return z
    .array(wearRowSchema)
    .parse(rows)
    .map((r) => ({
      wornOn: r.worn_on,
      garmentIds: Array.isArray(r.garment_ids) ? r.garment_ids : [],
    }));
}
