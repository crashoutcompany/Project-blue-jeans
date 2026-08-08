import { cacheTag } from "next/cache";

import { getSql } from "@/lib/db";
import { CALENDAR_MONTH_TAG } from "@/lib/outfits/calendar-month-cache-tag";

export type CalendarSavedOutfit = {
  id: string;
  wornOn: string;
  imageUrl: string | null;
  name: string | null;
  occasion: string;
};

export type CalendarWeeklyLook = {
  planLookId: string;
  wornOn: string;
  title: string;
  heroImageUrl: string | null;
  garmentIds: string[];
};

function monthRangeIso(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Saved outfits and weekly plan looks overlapping the calendar month.
 * Weekly rows are only returned for days that have no saved outfit yet.
 */
export async function loadCalendarMonthData(
  year: number,
  month: number,
): Promise<{ saved: CalendarSavedOutfit[]; weeklyDrafts: CalendarWeeklyLook[] }> {
  "use cache";
  cacheTag(CALENDAR_MONTH_TAG);

  const sql = getSql();
  if (!sql) {
    return { saved: [], weeklyDrafts: [] };
  }

  const { start, end } = monthRangeIso(year, month);

  try {
    const savedRows = (await sql`
      SELECT
        id,
        worn_on::text AS worn_on,
        image_url,
        name,
        occasion::text AS occasion
      FROM outfits
      WHERE worn_on BETWEEN ${start}::date AND ${end}::date
      ORDER BY worn_on ASC, created_at ASC
    `) as {
      id: string;
      worn_on: string;
      image_url: string | null;
      name: string | null;
      occasion: string;
    }[];

    const saved: CalendarSavedOutfit[] = savedRows.map((r) => ({
      id: r.id,
      wornOn: r.worn_on,
      imageUrl: r.image_url,
      name: r.name,
      occasion: r.occasion,
    }));

    const daysWithSaved = new Set(saved.map((s) => s.wornOn));

    const weeklyRows = (await sql`
      SELECT
        l.id AS plan_look_id,
        (p.week_start + l.sort_order)::text AS worn_on,
        l.title,
        l.hero_image_url,
        l.garment_ids
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE p.status IN ('completed', 'draft')
        AND (p.week_start + l.sort_order) BETWEEN ${start}::date AND ${end}::date
      ORDER BY worn_on ASC, l.sort_order ASC
    `) as {
      plan_look_id: string;
      worn_on: string;
      title: string;
      hero_image_url: string | null;
      garment_ids: string[] | null;
    }[];

    const weeklyDrafts: CalendarWeeklyLook[] = [];
    for (const r of weeklyRows) {
      if (daysWithSaved.has(r.worn_on)) continue;
      const garmentIds = Array.isArray(r.garment_ids) ? r.garment_ids : [];
      weeklyDrafts.push({
        planLookId: r.plan_look_id,
        wornOn: r.worn_on,
        title: r.title,
        heroImageUrl: r.hero_image_url,
        garmentIds,
      });
    }

    return { saved, weeklyDrafts };
  } catch (e) {
    console.error("[outfits] loadCalendarMonthData failed", e);
    return { saved: [], weeklyDrafts: [] };
  }
}
