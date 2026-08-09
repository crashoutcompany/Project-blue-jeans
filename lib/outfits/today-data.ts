import { getSql } from "@/lib/db";
import { loadGarmentsByIds } from "@/lib/garments/load-catalog";
import {
  addDaysIso,
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";

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
  look: TodayLook | null;
  weekPeek: TodayWeekPeekDay[];
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

async function loadOutfitForDay(wornOn: string): Promise<{
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
    FROM outfits o
    LEFT JOIN outfit_garments og ON og.outfit_id = o.id
    WHERE o.worn_on = ${wornOn}::date
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

async function loadFitForDay(wornOn: string): Promise<{
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
    WHERE p.status IN ('completed', 'draft')
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

async function thumbsForIds(ids: string[]): Promise<TodayGarmentThumb[]> {
  if (ids.length === 0) return [];
  const rows = await loadGarmentsByIds(ids);
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

/**
 * Today home payload: Outfit > Fit > empty, plus Sunday–Saturday week peek.
 */
export async function loadTodayPageData(
  now = new Date(),
): Promise<TodayPageData> {
  const todayIso = productTodayIso(now);
  const weekStartIso = sundayWeekStartIso(todayIso);

  const sql = getSql();
  let garmentCount = 0;
  if (sql) {
    try {
      const countRows = (await sql`
        SELECT count(*)::int AS n FROM garments
      `) as { n: number }[];
      garmentCount = countRows[0]?.n ?? 0;
    } catch (e) {
      console.error("[today] garment count failed", e);
    }
  }

  const outfit = await loadOutfitForDay(todayIso);
  let look: TodayLook | null = null;

  if (outfit) {
    look = {
      kind: "outfit",
      id: outfit.id,
      title: outfit.name,
      heroImageUrl: outfit.imageUrl,
      garments: await thumbsForIds(outfit.garmentIds),
    };
  } else {
    const fit = await loadFitForDay(todayIso);
    if (fit) {
      look = {
        kind: "fit",
        id: fit.planLookId,
        title: fit.title,
        heroImageUrl: fit.heroImageUrl,
        garments: await thumbsForIds(fit.garmentIds),
        planLookId: fit.planLookId,
      };
    }
  }

  const weekPeek: TodayWeekPeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const wornOn = addDaysIso(weekStartIso, i);
    const label = WEEKDAY_SHORT[i]!;
    if (wornOn === todayIso && look) {
      weekPeek.push({
        wornOn,
        label,
        kind: look.kind,
        heroImageUrl: look.heroImageUrl,
      });
      continue;
    }
    const dayOutfit = await loadOutfitForDay(wornOn);
    if (dayOutfit) {
      weekPeek.push({
        wornOn,
        label,
        kind: "outfit",
        heroImageUrl: dayOutfit.imageUrl,
      });
      continue;
    }
    const dayFit = await loadFitForDay(wornOn);
    if (dayFit) {
      weekPeek.push({
        wornOn,
        label,
        kind: "fit",
        heroImageUrl: dayFit.heroImageUrl,
      });
      continue;
    }
    weekPeek.push({ wornOn, label, kind: "empty", heroImageUrl: null });
  }

  return {
    todayIso,
    weekStartIso,
    garmentCount,
    look,
    weekPeek,
  };
}
