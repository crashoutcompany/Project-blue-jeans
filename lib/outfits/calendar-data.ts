import { cacheTag } from "next/cache";
import { z } from "zod";

import { getSql } from "@/lib/db";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import {
  loadFitsInRange,
  loadOutfitsInRange,
} from "@/lib/outfits/day-looks-in-range";

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

const thumbRowSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().min(1),
  media_asset_id: z.string().uuid().nullable(),
});

function monthRangeIso(
  year: number,
  month: number,
): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
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
    const [outfitRows, fitRows] = await Promise.all([
      loadOutfitsInRange(userId, start, end, { order: "asc" }),
      loadFitsInRange(userId, start, end),
    ]);

    const savedDrafts = outfitRows.map((r) => ({
      id: r.id,
      wornOn: r.wornOn,
      imageUrl: r.imageUrl,
      name: r.name,
      occasion: r.occasion,
      garmentIds: r.garmentIds,
    }));

    const daysWithSaved = new Set(savedDrafts.map((s) => s.wornOn));

    const weeklyDraftsRaw = fitRows.flatMap((r) => {
      if (daysWithSaved.has(r.wornOn)) return [];
      return [
        {
          planLookId: r.planLookId,
          wornOn: r.wornOn,
          title: r.title,
          heroImageUrl: r.heroImageUrl,
          garmentIds: r.garmentIds,
        },
      ];
    });

    const garmentIds = [
      ...savedDrafts.filter((s) => !s.imageUrl).flatMap((s) => s.garmentIds),
      ...weeklyDraftsRaw
        .filter((w) => !w.heroImageUrl)
        .flatMap((w) => w.garmentIds),
    ];
    const uniqueIds = [...new Set(garmentIds)];
    const thumbById = new Map<string, CalendarLookThumb>();
    if (uniqueIds.length > 0) {
      const thumbRows = await sql`
        SELECT id, image_url, media_asset_id
        FROM garments
        WHERE user_id = ${userId}
          AND id = ANY(${uniqueIds}::uuid[])
          AND image_url IS NOT NULL
          AND image_url <> ''
      `;
      const parsed = z.array(thumbRowSchema).safeParse(thumbRows);
      if (parsed.success) {
        for (const row of parsed.data) {
          thumbById.set(row.id, {
            id: row.id,
            imageUrl: row.media_asset_id
              ? mediaAssetDisplayPath(row.media_asset_id)
              : row.image_url,
          });
        }
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
