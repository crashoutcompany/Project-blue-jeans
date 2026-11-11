import { formatClosetCatalog, type CatalogGarment } from "@/lib/ai/lookbook/catalog";
import {
  dayWeatherPrompt,
  weatherSafeGarments,
} from "@/lib/ai/weather/day-weather-rules";
import { isOutfitPlanError } from "@/lib/ai/lookbook/plan-error";
import type { AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { loadGarmentsByIds } from "@/lib/garments/load-catalog";
import { createHeroImageStore } from "@/lib/media/hero-assets";
import {
  resolveGarmentImageSourcesForAi,
  resolveOwnedImageFetchUrl,
} from "@/lib/media/owned-image";
import {
  existingHeroForGarments,
  findExistingOutfitHeroUrls,
} from "@/lib/outfits/existing-outfit-heroes";
import {
  catalogCanFormLook,
  countLookSlots,
  lookStackError,
} from "@/lib/outfits/look-composition";
import {
  isRepeatOf,
  repeatGuardForDay,
  type RecentWear,
} from "@/lib/outfits/repeat-guard";
import {
  availableGarments,
  type WeeklyPlanDay,
} from "@/lib/outfits/weekly-plan-catalog";
import { getWearerPhoto } from "@/lib/wearer/profile";

/**
 * A full week is 7 looks, and each hero is a multimodal generation plus up to
 * 15 image fetches. Firing all of them at once spikes provider rate limits and
 * memory; the generator path is effectively capped at 3 for the same reason.
 */
const HERO_IMAGE_CONCURRENCY = 3;

const DAY_RETRY_PUBLIC = "Try again in a moment.";

/** Plans per day when the model keeps picking an Outfit worn recently. */
const MAX_REPEAT_ATTEMPTS = 2;

const REPEAT_HINT =
  "\n\nIMPORTANT: Your last outfit was one of the recently worn outfits. Pick a different combination: change at least one piece.";

/** Confirmed wears and the Wearer's repeat window, for the repeat guard. */
export type RepeatWindowInput = {
  wears: readonly RecentWear[];
  windowDays: number;
};

export type WeeklyLook = {
  sortOrder: number;
  title: string;
  description: string;
  tags: string[];
  garmentIds: string[];
};

export type WeeklyStyleInput = {
  apiKey: string;
  climate: string;
  context: string;
  narrative: string;
  location: string;
};

export type PlanWeeklyDayResult =
  | { status: "planned"; plan: LookbookPlan; look: WeeklyLook }
  /** Closet has no top, bottom and shoes left once locked tops are removed. */
  | { status: "closet-exhausted" }
  | { status: "failed"; message: string; error: unknown; garmentCount: number };

export function garmentNamesForIds(
  ids: string[],
  byId: Map<string, { name: string | null }>,
): string[] {
  return ids.map((id) => byId.get(id)?.name?.trim() || "Untitled");
}

/** "Couldn't plan Friday. <why>", safe to show and to store on the day. */
export function dayFailureMessage(weekday: string, error: unknown): string {
  const why = isOutfitPlanError(error)
    ? error.publicMessage
    : error instanceof DayStackError
      ? error.message
      : DAY_RETRY_PUBLIC;
  return `Couldn't plan ${weekday}. ${why}`;
}

/** The model's look is not a wearable stack (e.g. no bottom). */
class DayStackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DayStackError";
  }
}

/**
 * Plan one day of the week from the closet minus `lockedTopIds`. Never throws
 * for a model failure: the caller keeps the other days and shows `message`
 * on this one. With `day.forecast`, the model gets that day's weather rules
 * (see `dayWeatherRules`) and wet days leave suede out of the catalog.
 *
 * Repeat guard: Outfits confirmed worn inside the repeat window are named in
 * the prompt, and a plan that still repeats one exactly is asked for again
 * once. A closet too small to avoid them all releases the oldest wears first
 * (see `repeatGuardForDay`), and a model that repeats twice keeps its look
 * rather than leave the day empty.
 */
export async function planWeeklyDay(
  style: WeeklyStyleInput,
  day: WeeklyPlanDay,
  garments: CatalogGarment[],
  categoryById: ReadonlyMap<string, string>,
  lockedTopIds: ReadonlySet<string>,
  alreadyPlanned: AlreadyPlannedLook[],
  repeat?: RepeatWindowInput,
): Promise<PlanWeeklyDayResult> {
  const available = weatherSafeGarments(
    availableGarments(garments, lockedTopIds),
    day.forecast,
  );
  if (!catalogCanFormLook(available)) return { status: "closet-exhausted" };

  const { avoid } = repeat
    ? repeatGuardForDay({
        wears: repeat.wears,
        dayIso: day.iso,
        windowDays: repeat.windowDays,
        available,
      })
    : { avoid: [] };
  const garmentsById = new Map(garments.map((g) => [g.id, g]));
  const avoidOutfits = avoid.map((w) =>
    garmentNamesForIds(w.garmentIds, garmentsById),
  );

  try {
    let plan: LookbookPlan | undefined;
    let narrative = style.narrative;
    for (let attempt = 1; attempt <= MAX_REPEAT_ATTEMPTS; attempt++) {
      plan = await runStep1PlanWithRetry({
        apiKey: style.apiKey,
        lookCount: 1,
        climate: style.climate,
        context: style.context,
        narrative,
        catalogText: formatClosetCatalog(available),
        validIds: new Set(available.map((g) => g.id)),
        location: style.location,
        weekly: true,
        weeklyWeekday: day.weekday,
        dayWeather: day.forecast
          ? dayWeatherPrompt(day.forecast, day.weekday, style.location)
          : undefined,
        alreadyPlanned: alreadyPlanned.slice(),
        avoidOutfits: avoidOutfits.length > 0 ? avoidOutfits : undefined,
      });
      const ids = plan.looks[0]?.garmentIds ?? [];
      if (!isRepeatOf(ids, avoid)) break;
      narrative = style.narrative + REPEAT_HINT;
    }
    const look = plan?.looks[0];
    if (!plan || !look) throw new Error(`Day ${day.weekday} returned no look.`);
    const garmentIds = look.garmentIds ?? [];
    const stackErr = lookStackError(countLookSlots(garmentIds, categoryById));
    if (stackErr) throw new DayStackError(stackErr);

    return {
      status: "planned",
      plan,
      look: {
        sortOrder: day.sortOrder,
        title: look.title,
        description: look.description,
        tags: look.tags,
        garmentIds,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      message: dayFailureMessage(day.weekday, error),
      error,
      garmentCount: available.length,
    };
  }
}

export type LookHeroOutcome = {
  sortOrder: number;
  url: string | null;
  missingGarments: boolean;
};

/**
 * Hero image per look, bounded. Looks whose garment set already has a stored
 * Outfit hero reuse that image instead of generating.
 */
export async function renderWeeklyLookHeroes(
  userId: string,
  style: WeeklyStyleInput,
  looks: WeeklyLook[],
): Promise<LookHeroOutcome[]> {
  const [existingHeroes, wearerPhoto] = await Promise.all([
    findExistingOutfitHeroUrls(
      userId,
      looks.map((look) => look.garmentIds),
    ),
    getWearerPhoto(userId),
  ]);
  const needsGeneratedHero = looks.some(
    (look) =>
      look.garmentIds.length > 0 &&
      !existingHeroForGarments(existingHeroes, look.garmentIds),
  );
  const wearer = needsGeneratedHero ? wearerPhoto : null;
  const storeHeroImage = createHeroImageStore(userId);

  return mapWithConcurrency(looks, HERO_IMAGE_CONCURRENCY, async (look) => {
    const ids = look.garmentIds;
    if (ids.length === 0) {
      return { sortOrder: look.sortOrder, url: null, missingGarments: true };
    }
    const reused = existingHeroForGarments(existingHeroes, ids);
    if (reused) {
      return { sortOrder: look.sortOrder, url: reused, missingGarments: false };
    }
    const rows = await loadGarmentsByIds(userId, ids);
    const idOrder = new Map(ids.map((id, j) => [id, j]));
    rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    try {
      const garments = await resolveGarmentImageSourcesForAi(userId, rows);
      if (garments.length === 0) {
        return { sortOrder: look.sortOrder, url: null, missingGarments: false };
      }
      const wearerPhotoUrl = wearer
        ? await resolveOwnedImageFetchUrl(userId, {
            mediaAssetId: wearer.mediaAssetId,
            imageUrl: wearer.imageUrl,
          })
        : null;
      const heroImage = await runHeroImageStep({
        apiKey: style.apiKey,
        title: look.title,
        description: look.description,
        climate: style.climate,
        context: style.context,
        narrative: style.narrative,
        garments,
        wearerPhotoUrl,
      });
      return {
        sortOrder: look.sortOrder,
        url: heroImage ? await storeHeroImage(heroImage) : null,
        missingGarments: false,
      };
    } catch {
      return { sortOrder: look.sortOrder, url: null, missingGarments: false };
    }
  });
}
