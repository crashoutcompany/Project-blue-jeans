import { z } from "zod";

import { getSql } from "@/lib/db";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const outfitWearRowSchema = z.object({
  worn_on: isoDateSchema,
  id: z.string().uuid(),
  name: z.string().nullable(),
  image_url: z.string().nullable(),
  occasion: z.string().optional().default("casual"),
  garment_ids: z.array(z.string()).nullable().optional(),
});

const fitRowSchema = z.object({
  worn_on: isoDateSchema,
  plan_look_id: z.string().uuid(),
  title: z.string(),
  hero_image_url: z.string().nullable(),
  garment_ids: z.array(z.string()).nullable().optional(),
});

export type OutfitInRange = {
  wornOn: string;
  id: string;
  name: string | null;
  imageUrl: string | null;
  occasion: string;
  garmentIds: string[];
};

export type FitInRange = {
  wornOn: string;
  planLookId: string;
  title: string;
  heroImageUrl: string | null;
  garmentIds: string[];
};

function asIdList(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

/** Keep the first row for each calendar day (caller controls order). */
export function firstPerDay<T extends { wornOn: string }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.wornOn)) map.set(row.wornOn, row);
  }
  return map;
}

function parseOutfitRows(raw: unknown): OutfitInRange[] {
  const rows = z.array(outfitWearRowSchema).parse(raw);
  return rows.map((row) => ({
    wornOn: row.worn_on,
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    occasion: row.occasion,
    garmentIds: asIdList(row.garment_ids),
  }));
}

function parseFitRows(raw: unknown): FitInRange[] {
  const rows = z.array(fitRowSchema).parse(raw);
  return rows.map((row) => ({
    wornOn: row.worn_on,
    planLookId: row.plan_look_id,
    title: row.title,
    heroImageUrl: row.hero_image_url,
    garmentIds: asIdList(row.garment_ids),
  }));
}

/**
 * Outfits worn in [startIso, endIso] for one Wearer. Newest wear wins when
 * ordering prefers `created_at DESC` (Today); Calendar passes ASC and still
 * gets at most one wear per day via UNIQUE (user_id, worn_on).
 */
export async function loadOutfitsInRange(
  userId: string,
  startIso: string,
  endIso: string,
  options?: { order?: "asc" | "desc" },
): Promise<OutfitInRange[]> {
  const sql = getSql();
  if (!sql || !userId) return [];

  const order = options?.order === "asc" ? "asc" : "desc";

  try {
    const rows =
      order === "asc"
        ? await sql`
            SELECT
              w.worn_on::text AS worn_on,
              o.id,
              o.name,
              o.image_url,
              o.occasion::text AS occasion,
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
              AND w.worn_on >= ${startIso}::date
              AND w.worn_on <= ${endIso}::date
            GROUP BY w.worn_on, o.id
            ORDER BY w.worn_on ASC, o.created_at ASC
          `
        : await sql`
            SELECT
              w.worn_on::text AS worn_on,
              o.id,
              o.name,
              o.image_url,
              o.occasion::text AS occasion,
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
              AND w.worn_on >= ${startIso}::date
              AND w.worn_on <= ${endIso}::date
            GROUP BY w.worn_on, o.id
            ORDER BY w.worn_on ASC, o.created_at DESC
          `;
    return parseOutfitRows(rows);
  } catch (e) {
    console.error("[outfits] loadOutfitsInRange failed", e);
    return [];
  }
}

/**
 * Weekly Fits (plan looks) whose calendar day falls in [startIso, endIso].
 */
export async function loadFitsInRange(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<FitInRange[]> {
  const sql = getSql();
  if (!sql || !userId) return [];

  try {
    const rows = await sql`
      SELECT
        (p.week_start + l.sort_order)::text AS worn_on,
        l.id AS plan_look_id,
        l.title,
        l.hero_image_url,
        l.garment_ids
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE p.user_id = ${userId}
        AND p.status IN ('completed', 'draft')
        AND (p.week_start + l.sort_order) >= ${startIso}::date
        AND (p.week_start + l.sort_order) <= ${endIso}::date
      ORDER BY
        (p.week_start + l.sort_order) ASC,
        p.updated_at DESC NULLS LAST,
        l.sort_order ASC
    `;
    return parseFitRows(rows);
  } catch (e) {
    console.error("[outfits] loadFitsInRange failed", e);
    return [];
  }
}

/** First Outfit per day (newest-first query order). */
export async function loadOutfitsByDay(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<Map<string, OutfitInRange>> {
  const rows = await loadOutfitsInRange(userId, startIso, endIso, {
    order: "desc",
  });
  return firstPerDay(rows);
}

/** First Fit per day (most recently updated plan wins). */
export async function loadFitsByDay(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<Map<string, FitInRange>> {
  const rows = await loadFitsInRange(userId, startIso, endIso);
  return firstPerDay(rows);
}
