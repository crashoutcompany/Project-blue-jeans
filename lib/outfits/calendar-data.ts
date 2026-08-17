import { cacheTag } from "next/cache";

import { getSql } from "@/lib/db";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";

export type CalendarLookThumb = {
  id: string;
  imageUrl: string;
};

export type CalendarSavedOutfit = {
  id: string;
  wornOn: string;
  imageUrl: string | null;
  name: string | null;
  occasion: string;
  garmentThumbs: CalendarLookThumb[];
};

export type CalendarWeeklyLook = {
  planLookId: string;
  wornOn: string;
  title: string;
  heroImageUrl: string | null;
  garmentIds: string[];
  garmentThumbs: CalendarLookThumb[];
};

function monthRangeIso(
  year: number,
  month: number,
): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function asIdList(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function thumbsForIds(
  ids: string[],
  byId: Map<string, CalendarLookThumb>,
): CalendarLookThumb[] {
  const out: CalendarLookThumb[] = [];
  for (const id of ids) {
    const thumb = byId.get(id);
    if (!thumb) continue;
    out.push(thumb);
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Saved outfits and weekly plan looks overlapping the calendar month.
 * Weekly rows are only returned for days that have no saved outfit yet.
 */
export async function loadCalendarMonthData(
  userId: string,
  year: number,
  month: number,
): Promise<{
  saved: CalendarSavedOutfit[];
  weeklyDrafts: CalendarWeeklyLook[];
}> {
  "use cache";
  cacheTag(calendarMonthTag(userId));

  const sql = getSql();
  if (!sql || !userId) {
    return { saved: [], weeklyDrafts: [] };
  }

  const { start, end } = monthRangeIso(year, month);

  try {
    const savedQuery = sql`
      SELECT
        o.id,
        w.worn_on::text AS worn_on,
        o.image_url,
        o.name,
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
        AND w.worn_on BETWEEN ${start}::date AND ${end}::date
      GROUP BY w.worn_on, o.id
      ORDER BY w.worn_on ASC, o.created_at ASC
    `;
    const weeklyQuery = sql`
      SELECT
        l.id AS plan_look_id,
        (p.week_start + l.sort_order)::text AS worn_on,
        l.title,
        l.hero_image_url,
        l.garment_ids
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE p.user_id = ${userId}
        AND p.status IN ('completed', 'draft')
        AND (p.week_start + l.sort_order) BETWEEN ${start}::date AND ${end}::date
      ORDER BY worn_on ASC, l.sort_order ASC
    `;

    const [savedResult, weeklyResult] = await Promise.all([
      savedQuery,
      weeklyQuery,
    ]);
    const savedRows = savedResult as {
      id: string;
      worn_on: string;
      image_url: string | null;
      name: string | null;
      occasion: string;
      garment_ids: string[] | null;
    }[];
    const weeklyRows = weeklyResult as {
      plan_look_id: string;
      worn_on: string;
      title: string;
      hero_image_url: string | null;
      garment_ids: string[] | null;
    }[];

    const savedDrafts = savedRows.map((r) => ({
      id: r.id,
      wornOn: r.worn_on,
      imageUrl: r.image_url,
      name: r.name,
      occasion: r.occasion,
      garmentIds: asIdList(r.garment_ids),
    }));

    const daysWithSaved = new Set(savedDrafts.map((s) => s.wornOn));

    const weeklyDraftsRaw = weeklyRows.flatMap((r) => {
      if (daysWithSaved.has(r.worn_on)) return [];
      return [
        {
          planLookId: r.plan_look_id,
          wornOn: r.worn_on,
          title: r.title,
          heroImageUrl: r.hero_image_url,
          garmentIds: asIdList(r.garment_ids),
        },
      ];
    });

    const garmentIds = [
      ...savedDrafts
        .filter((s) => !s.imageUrl)
        .flatMap((s) => s.garmentIds),
      ...weeklyDraftsRaw
        .filter((w) => !w.heroImageUrl)
        .flatMap((w) => w.garmentIds),
    ];
    const uniqueIds = [...new Set(garmentIds)];
    const thumbById = new Map<string, CalendarLookThumb>();
    if (uniqueIds.length > 0) {
      const thumbRows = (await sql`
        SELECT id, image_url
        FROM garments
        WHERE user_id = ${userId}
          AND id = ANY(${uniqueIds}::uuid[])
          AND image_url IS NOT NULL
          AND image_url <> ''
      `) as { id: string; image_url: string }[];
      for (const row of thumbRows) {
        thumbById.set(row.id, { id: row.id, imageUrl: row.image_url });
      }
    }

    const saved: CalendarSavedOutfit[] = savedDrafts.map((s) => ({
      id: s.id,
      wornOn: s.wornOn,
      imageUrl: s.imageUrl,
      name: s.name,
      occasion: s.occasion,
      garmentThumbs: thumbsForIds(s.garmentIds, thumbById),
    }));

    const weeklyDrafts: CalendarWeeklyLook[] = weeklyDraftsRaw.map((w) => ({
      ...w,
      garmentThumbs: thumbsForIds(w.garmentIds, thumbById),
    }));

    return { saved, weeklyDrafts };
  } catch (e) {
    console.error("[outfits] loadCalendarMonthData failed", e);
    return { saved: [], weeklyDrafts: [] };
  }
}
