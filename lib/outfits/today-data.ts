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

async function loadOutfitForDay(
  userId: string,
  wornOn: string,
): Promise<{
  id: string;
  name: string | null;
  imageUrl: string | null;
  garmentIds: string[];
} | null> {
  const sql = getSql();
  if (!sql) return null;

  const rows = (await sql`
    SELECT
      o.id,
      o.name,
      o.image_url,
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
      AND w.worn_on = ${wornOn}::date
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 1
  `) as {
    id: string;
    name: string | null;
    image_url: string | null;
    garment_ids: string[] | null;
  }[];

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    garmentIds: Array.isArray(row.garment_ids) ? row.garment_ids : [],
  };
}

async function loadFitForDay(
  userId: string,
  wornOn: string,
): Promise<{
  planLookId: string;
  title: string;
  heroImageUrl: string | null;
  garmentIds: string[];
} | null> {
  const sql = getSql();
  if (!sql) return null;

  const rows = (await sql`
    SELECT
      l.id AS plan_look_id,
      l.title,
      l.hero_image_url,
      l.garment_ids
    FROM weekly_plan_looks l
    INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
    WHERE p.user_id = ${userId}
      AND p.status IN ('completed', 'draft')
      AND (p.week_start + l.sort_order) = ${wornOn}::date
    ORDER BY p.updated_at DESC NULLS LAST, l.sort_order ASC
    LIMIT 1
  `) as {
    plan_look_id: string;
    title: string;
    hero_image_url: string | null;
    garment_ids: string[] | null;
  }[];

  const row = rows[0];
  if (!row) return null;
  return {
    planLookId: row.plan_look_id,
    title: row.title,
    heroImageUrl: row.hero_image_url,
    garmentIds: Array.isArray(row.garment_ids) ? row.garment_ids : [],
  };
}

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

async function loadLookForDay(
  userId: string,
  wornOn: string,
): Promise<TodayLook | null> {
  const outfit = await loadOutfitForDay(userId, wornOn);
  if (outfit) {
    return {
      kind: "outfit",
      id: outfit.id,
      title: outfit.name,
      heroImageUrl: outfit.imageUrl,
      garments: await thumbsForIds(userId, outfit.garmentIds),
    };
  }
  const fit = await loadFitForDay(userId, wornOn);
  if (fit) {
    return {
      kind: "fit",
      id: fit.planLookId,
      title: fit.title,
      heroImageUrl: fit.heroImageUrl,
      garments: await thumbsForIds(userId, fit.garmentIds),
      planLookId: fit.planLookId,
    };
  }
  return null;
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

  const dayLoads = Array.from({ length: 7 }, (_, i) => {
    const wornOn = addDaysIso(weekStartIso, i);
    return loadLookForDay(userId, wornOn).then((look) => ({
      wornOn,
      label: WEEKDAY_SHORT[i]!,
      look,
    }));
  });

  const [garmentCount, wearerPhoto, days] = await Promise.all([
    garmentCountPromise,
    getWearerPhoto(userId),
    Promise.all(dayLoads),
  ]);

  const weekLooks: Record<string, TodayLook> = {};
  const weekPeek: TodayWeekPeekDay[] = [];
  for (const day of days) {
    if (day.look) {
      weekLooks[day.wornOn] = day.look;
    }
    weekPeek.push({
      wornOn: day.wornOn,
      label: day.label,
      kind: day.look?.kind ?? "empty",
      heroImageUrl: day.look?.heroImageUrl ?? null,
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
