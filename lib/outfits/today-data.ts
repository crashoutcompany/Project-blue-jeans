import {
  fetchWeather,
  type DayForecast,
} from "@/lib/ai/weather/fetch-weather";
import { formatTodayWeatherLine } from "@/lib/ai/weather/format-today-line";
import { resolveOutfitLocation } from "@/lib/ai/weather/constants";
import { loadDayForecasts } from "@/lib/ai/weather/load-day-forecasts";
import { getSql } from "@/lib/db";
import { loadGarmentsByIds } from "@/lib/garments/load-catalog";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import {
  loadFitsByDay,
  loadOutfitsByDay,
  type FitInRange,
  type OutfitInRange,
} from "@/lib/outfits/day-looks-in-range";
import { loadFailedPlanDaysByDay } from "@/lib/outfits/weekly-plan-failures";
import { loadPlannedWeatherByDay } from "@/lib/outfits/weekly-plan-weather";
import {
  findLastSimilarWornDay,
  formatSimilarDayWeather,
  SIMILAR_DAY_LOOKBACK_DAYS,
  similarDayLookbackStartIso,
} from "@/lib/outfits/similar-weather-day";
import {
  buildWeekWeather,
  type TodayDayWeather,
} from "@/lib/outfits/week-weather";
import {
  addDaysIso,
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { getWearerLocation } from "@/lib/wearer/preferences";
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
  /** For Outfits — the Wearer tapped "Wore this" for this day. */
  worn?: boolean;
};

export type TodayWeekPeekDay = {
  wornOn: string;
  label: string;
  kind: "outfit" | "fit" | "empty";
  heroImageUrl: string | null;
  /** "Plan my week" could not plan this (empty) day. */
  failed?: boolean;
};

/** A past day's Outfit in the "what did you wear?" review before planning. */
export type TodayWornReviewItem = {
  wornOn: string;
  outfitId: string;
  title: string | null;
  heroImageUrl: string | null;
  garments: TodayGarmentThumb[];
  /** Already confirmed with "Wore this". */
  worn: boolean;
};

/** The Outfit worn on the most recent day with weather like today's. */
export type TodaySimilarDay = {
  wornOn: string;
  outfitId: string;
  title: string | null;
  heroImageUrl: string | null;
  garments: TodayGarmentThumb[];
  /** That day's weather, e.g. "rain · 48° / 39°". */
  weather: string;
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
  /** Days with no look that planning failed on, keyed by wornOn. */
  failedDays: Record<string, string>;
  /**
   * Outfits from last week's Sunday through yesterday, oldest first, so the
   * Wearer can tap "Wore this" before Plan my week.
   */
  lastWeek: TodayWornReviewItem[];
  /** Soft prompt when missing; try-on heroes when present. */
  hasWearerPhoto: boolean;
  /** Quiet line under today's date, e.g. "New York, NY · 54° rain". */
  weatherLine: string;
  /** Forecast for today and later days, keyed by wornOn; empty if unavailable. */
  weekWeather: Record<string, TodayDayWeather>;
  /**
   * Today card: the last worn day (within the lookback) whose weather matched
   * today's forecast. Null without a forecast or a match.
   */
  lastSimilarDay: TodaySimilarDay | null;
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
    worn: outfit.worn,
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

function similarDayFromOutfit(
  outfit: OutfitInRange,
  weather: DayForecast,
  thumbsById: Map<string, TodayGarmentThumb>,
): TodaySimilarDay {
  const look = lookFromOutfit(outfit, thumbsById);
  return {
    wornOn: outfit.wornOn,
    outfitId: outfit.id,
    title: look.title,
    heroImageUrl: look.heroImageUrl,
    garments: look.garments,
    weather: formatSimilarDayWeather(weather),
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
      failedDays: {},
      lastWeek: [],
      hasWearerPhoto: false,
      weatherLine: resolveOutfitLocation(),
      weekWeather: {},
      lastSimilarDay: null,
    };
  }

  const sql = getSql();
  const locationPromise = getWearerLocation(userId);
  const weatherLinePromise = locationPromise.then(async (stored) => {
    const place = resolveOutfitLocation(stored ?? undefined);
    try {
      const snapshot = await fetchWeather(
        { location: place },
        { abortSignal: AbortSignal.timeout(5_000) },
      );
      return formatTodayWeatherLine(place, snapshot.ok ? snapshot : null);
    } catch (e) {
      console.error("[today] weather failed", e);
      return place;
    }
  });
  const weekWeatherPromise = locationPromise.then(async (stored) => {
    const place = resolveOutfitLocation(stored ?? undefined);
    const [forecastByDay, plannedByDay] = await Promise.all([
      // Past days let the Today card find a worn day with similar weather.
      loadDayForecasts(place, { pastDays: SIMILAR_DAY_LOOKBACK_DAYS }),
      loadPlannedWeatherByDay(userId, weekStartIso),
    ]);
    return { place, forecastByDay, plannedByDay };
  });
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
  const reviewStartIso = addDaysIso(weekStartIso, -7);
  const yesterdayIso = addDaysIso(todayIso, -1);
  // One read covers last week's review and the similar-weather lookback.
  const pastPromise = loadOutfitsByDay(
    userId,
    similarDayLookbackStartIso(todayIso),
    yesterdayIso,
  );

  const [
    garmentCount,
    wearerPhoto,
    outfitsByDay,
    fitsByDay,
    weatherLine,
    failedByDay,
    pastByDay,
    weekWeatherInput,
  ] = await Promise.all([
    garmentCountPromise,
    getWearerPhoto(userId),
    outfitsPromise,
    fitsPromise,
    weatherLinePromise,
    loadFailedPlanDaysByDay(userId, weekStartIso),
    pastPromise,
    weekWeatherPromise,
  ]);

  const reviewOutfits = [...pastByDay.values()].filter(
    (outfit) => outfit.wornOn >= reviewStartIso,
  );
  const similar = findLastSimilarWornDay({
    todayIso,
    forecastByDay: weekWeatherInput.forecastByDay,
    outfits: pastByDay.values(),
  });

  const referencedIds = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const wornOn = addDaysIso(weekStartIso, i);
    const outfit = outfitsByDay.get(wornOn);
    const fit = fitsByDay.get(wornOn);
    const ids = outfit?.garmentIds ?? fit?.garmentIds ?? [];
    for (const id of ids) referencedIds.add(id);
  }
  for (const outfit of reviewOutfits) {
    for (const id of outfit.garmentIds) referencedIds.add(id);
  }
  for (const id of similar?.outfit.garmentIds ?? []) referencedIds.add(id);

  let thumbs: TodayGarmentThumb[] = [];
  try {
    thumbs = await thumbsForIds(userId, [...referencedIds]);
  } catch (e) {
    console.error("[today] load garment thumbs failed", e);
  }
  const thumbsById = new Map(thumbs.map((t) => [t.id, t]));

  const weekLooks: Record<string, TodayLook> = {};
  const weekPeek: TodayWeekPeekDay[] = [];
  const failedDays: Record<string, string> = {};
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
    // A look that exists (e.g. picked with Change look) wins over an old error.
    const failure = look ? undefined : failedByDay.get(wornOn);
    if (failure) failedDays[wornOn] = failure;
    weekPeek.push({
      wornOn,
      label: WEEKDAY_SHORT[i]!,
      kind: look?.kind ?? "empty",
      heroImageUrl: look?.heroImageUrl ?? null,
      ...(failure ? { failed: true } : {}),
    });
  }

  const lastWeek: TodayWornReviewItem[] = reviewOutfits
    .sort((a, b) => a.wornOn.localeCompare(b.wornOn))
    .map((outfit) => {
      const look = lookFromOutfit(outfit, thumbsById);
      return {
        wornOn: outfit.wornOn,
        outfitId: outfit.id,
        title: look.title,
        heroImageUrl: look.heroImageUrl,
        garments: look.garments,
        worn: outfit.worn,
      };
    });
  const fitDays = new Set(
    Object.entries(weekLooks)
      .filter(([, look]) => look.kind === "fit")
      .map(([wornOn]) => wornOn),
  );

  return {
    todayIso,
    weekStartIso,
    garmentCount,
    look: weekLooks[todayIso] ?? null,
    weekLooks,
    weekPeek,
    failedDays,
    lastWeek,
    hasWearerPhoto: Boolean(wearerPhoto?.imageUrl),
    weatherLine,
    weekWeather: buildWeekWeather({
      todayIso,
      weekStartIso,
      fitDays,
      ...weekWeatherInput,
    }),
    lastSimilarDay: similar
      ? similarDayFromOutfit(similar.outfit, similar.weather, thumbsById)
      : null,
  };
}
