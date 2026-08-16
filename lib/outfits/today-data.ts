import { getSql } from "@/lib/db";
import { loadGarmentsByIds } from "@/lib/garments/load-catalog";
import {
  addDaysIso,
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { getWearerPhoto } from "@/lib/wearer/profile";

export type TodayGarmentThumb = {
  id: string;
  name: string | null;
  imageUrl: string;
  category: string;
};

export type TodayLookKind = "outfit" | "fit";

export type TodayLook = {
  kind: TodayLookKind;
  /** Outfit id or weekly plan look id */
  id: string;
  title: string | null;
  heroImageUrl: string | null;
  garments: TodayGarmentThumb[];
  /** For Fits — pass to approveWeeklyPlanLook */
  planLookId?: string;
};

export type TodayWeekPeekDay = {
  wornOn: string;
  label: string;
  kind: "outfit" | "fit" | "empty";
  heroImageUrl: string | null;
};

export type TodayPageData = {
  todayIso: string;
  weekStartIso: string;
  garmentCount: number;
  /** Today’s look (Outfit > Fit > null). */
  look: TodayLook | null;
  /** Full looks for the Sunday–Saturday week keyed by wornOn. */
  weekLooks: Record<string, TodayLook>;
  weekPeek: TodayWeekPeekDay[];
  /** Soft prompt when missing; try-on heroes when present. */
  hasWearerPhoto: boolean;
};

const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

async function thumbsForIds(
  userId: string,
  ids: string[],
): Promise<TodayGarmentThumb[]> {
  if (ids.length === 0) return [];
  const rows = await loadGarmentsByIds(userId, ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => {
      const r = byId.get(id);
      if (!r) return null;
      return {
        id: r.id,
        name: r.name,
        imageUrl: r.image_url,
        category: r.category,
      };
    })
    .filter((g): g is TodayGarmentThumb => g != null);
}

type DayOutfit = {
  wornOn: string;
  id: string;
  name: string | null;
  imageUrl: string | null;
  garmentIds: string[];
};

type DayFit = {
  wornOn: string;
  planLookId: string;
  title: string;
  heroImageUrl: string | null;
  garmentIds: string[];
};

function firstPerDay<T extends { wornOn: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.wornOn)) map.set(row.wornOn, row);
  }
  return map;
}

async function loadOutfitsForWeek(
  userId: string,
  weekStartIso: string,
  weekEndIso: string,
): Promise<Map<string, DayOutfit>> {
  const sql = getSql();
  if (!sql) return new Map();
  try {
    const rows = (await sql`
      SELECT
        w.worn_on::text AS worn_on,
        o.id,
        o.name,
        o.image_url,
        o.created_at,
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
        AND w.worn_on >= ${weekStartIso}::date
        AND w.worn_on <= ${weekEndIso}::date
      GROUP BY w.worn_on, o.id
      ORDER BY w.worn_on, o.created_at DESC
    `) as {
      worn_on: string;
      id: string;
      name: string | null;
      image_url: string | null;
      garment_ids: string[] | null;
    }[];
    return firstPerDay(
      rows.map((row) => ({
        wornOn: row.worn_on,
        id: row.id,
        name: row.name,
        imageUrl: row.image_url,
        garmentIds: Array.isArray(row.garment_ids) ? row.garment_ids : [],
      })),
    );
  } catch (e) {
    console.error("[today] load outfits for week failed", e);
    return new Map();
  }
}

async function loadFitsForWeek(
  userId: string,
  weekStartIso: string,
  weekEndIso: string,
): Promise<Map<string, DayFit>> {
  const sql = getSql();
  if (!sql) return new Map();
  try {
    const rows = (await sql`
      SELECT
        (p.week_start + l.sort_order)::text AS worn_on,
        l.id AS plan_look_id,
        l.title,
        l.hero_image_url,
        l.garment_ids,
        p.updated_at,
        l.sort_order
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE p.user_id = ${userId}
        AND p.status IN ('completed', 'draft')
        AND (p.week_start + l.sort_order) >= ${weekStartIso}::date
        AND (p.week_start + l.sort_order) <= ${weekEndIso}::date
      ORDER BY
        (p.week_start + l.sort_order),
        p.updated_at DESC NULLS LAST,
        l.sort_order ASC
    `) as {
      worn_on: string;
      plan_look_id: string;
      title: string;
      hero_image_url: string | null;
      garment_ids: string[] | null;
    }[];
    return firstPerDay(
      rows.map((row) => ({
        wornOn: row.worn_on,
        planLookId: row.plan_look_id,
        title: row.title,
        heroImageUrl: row.hero_image_url,
        garmentIds: Array.isArray(row.garment_ids) ? row.garment_ids : [],
      })),
    );
  } catch (e) {
    console.error("[today] load fits for week failed", e);
    return new Map();
  }
}

function lookFromOutfit(
  outfit: DayOutfit,
  thumbsById: Map<string, TodayGarmentThumb>,
): TodayLook {
  return {
    kind: "outfit",
    id: outfit.id,
    title: outfit.name,
    heroImageUrl: outfit.imageUrl,
    garments: outfit.garmentIds
      .map((id) => thumbsById.get(id))
      .filter((g): g is TodayGarmentThumb => g != null),
  };
}

function lookFromFit(
  fit: DayFit,
  thumbsById: Map<string, TodayGarmentThumb>,
): TodayLook {
  return {
    kind: "fit",
    id: fit.planLookId,
    title: fit.title,
    heroImageUrl: fit.heroImageUrl,
    garments: fit.garmentIds
      .map((id) => thumbsById.get(id))
      .filter((g): g is TodayGarmentThumb => g != null),
    planLookId: fit.planLookId,
  };
}

/**
 * Today home payload: Outfit > Fit > empty, plus Sunday–Saturday week peek
 * and full weekLooks for in-place day selection.
 */
export async function loadTodayPageData(
  userId: string,
  now = new Date(),
): Promise<TodayPageData> {
  const todayIso = productTodayIso(now);
  const weekStartIso = sundayWeekStartIso(todayIso);

  if (!userId) {
    return {
      todayIso,
      weekStartIso,
      garmentCount: 0,
      look: null,
      weekLooks: {},
      weekPeek: [],
      hasWearerPhoto: false,
    };
  }

  const sql = getSql();
  const garmentCountPromise = (async () => {
    if (!sql) return 0;
    try {
      const countRows = (await sql`
        SELECT count(*)::int AS n FROM garments
        WHERE user_id = ${userId}
      `) as { n: number }[];
      return countRows[0]?.n ?? 0;
    } catch (e) {
      console.error("[today] garment count failed", e);
      return 0;
    }
  })();

  const weekEndIso = addDaysIso(weekStartIso, 6);
  const outfitsPromise = loadOutfitsForWeek(userId, weekStartIso, weekEndIso);
  const fitsPromise = loadFitsForWeek(userId, weekStartIso, weekEndIso);

  const [garmentCount, wearerPhoto, outfitsByDay, fitsByDay] = await Promise.all(
    [garmentCountPromise, getWearerPhoto(userId), outfitsPromise, fitsPromise],
  );

  const referencedIds = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const wornOn = addDaysIso(weekStartIso, i);
    const outfit = outfitsByDay.get(wornOn);
    const fit = fitsByDay.get(wornOn);
    const ids = outfit?.garmentIds ?? fit?.garmentIds ?? [];
    for (const id of ids) referencedIds.add(id);
  }

  let thumbs: TodayGarmentThumb[] = [];
  try {
    thumbs = await thumbsForIds(userId, [...referencedIds]);
  } catch (e) {
    console.error("[today] load garment thumbs failed", e);
  }
  const thumbsById = new Map(thumbs.map((t) => [t.id, t]));

  const weekLooks: Record<string, TodayLook> = {};
  const weekPeek: TodayWeekPeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const wornOn = addDaysIso(weekStartIso, i);
    const outfit = outfitsByDay.get(wornOn);
    const fit = fitsByDay.get(wornOn);
    const look = outfit
      ? lookFromOutfit(outfit, thumbsById)
      : fit
        ? lookFromFit(fit, thumbsById)
        : null;
    if (look) weekLooks[wornOn] = look;
    weekPeek.push({
      wornOn,
      label: WEEKDAY_SHORT[i]!,
      kind: look?.kind ?? "empty",
      heroImageUrl: look?.heroImageUrl ?? null,
    });
  }

  return {
    todayIso,
    weekStartIso,
    garmentCount,
    look: weekLooks[todayIso] ?? null,
    weekLooks,
    weekPeek,
    hasWearerPhoto: Boolean(wearerPhoto?.imageUrl),
  };
}
