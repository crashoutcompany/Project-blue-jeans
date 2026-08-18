import { getSql } from "@/lib/db";
import { loadGarmentsByIds } from "@/lib/garments/load-catalog";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import {
  loadFitsByDay,
  loadOutfitsByDay,
  type FitInRange,
  type OutfitInRange,
} from "@/lib/outfits/day-looks-in-range";
import {
  addDaysIso,
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { getWearerPhoto } from "@/lib/wearer/profile";
import { z } from "zod";

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

const countRowSchema = z.object({ n: z.number().int() });

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
        imageUrl: r.media_asset_id
          ? mediaAssetDisplayPath(r.media_asset_id)
          : r.image_url,
        category: r.category,
      };
    })
    .filter((g): g is TodayGarmentThumb => g != null);
}

function lookFromOutfit(
  outfit: OutfitInRange,
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
  fit: FitInRange,
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
      const countRows = await sql`
        SELECT count(*)::int AS n FROM garments
        WHERE user_id = ${userId}
      `;
      const parsed = z.array(countRowSchema).safeParse(countRows);
      return parsed.success ? (parsed.data[0]?.n ?? 0) : 0;
    } catch (e) {
      console.error("[today] garment count failed", e);
      return 0;
    }
  })();

  const weekEndIso = addDaysIso(weekStartIso, 6);
  const outfitsPromise = loadOutfitsByDay(userId, weekStartIso, weekEndIso);
  const fitsPromise = loadFitsByDay(userId, weekStartIso, weekEndIso);

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
