import { formatClosetCatalog, type CatalogGarment } from "@/lib/ai/lookbook/catalog";
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
 * on this one.
 */
export async function planWeeklyDay(
  style: WeeklyStyleInput,
  day: WeeklyPlanDay,
  garments: CatalogGarment[],
  categoryById: ReadonlyMap<string, string>,
  lockedTopIds: ReadonlySet<string>,
  alreadyPlanned: AlreadyPlannedLook[],
): Promise<PlanWeeklyDayResult> {
  const available = availableGarments(garments, lockedTopIds);
  if (!catalogCanFormLook(available)) return { status: "closet-exhausted" };

  try {
    const plan = await runStep1PlanWithRetry({
      apiKey: style.apiKey,
      lookCount: 1,
      climate: style.climate,
      context: style.context,
      narrative: style.narrative,
      catalogText: formatClosetCatalog(available),
      validIds: new Set(available.map((g) => g.id)),
      location: style.location,
      weekly: true,
      weeklyWeekday: day.weekday,
      alreadyPlanned: alreadyPlanned.slice(),
    });
    const look = plan.looks[0];
    if (!look) throw new Error(`Day ${day.weekday} returned no look.`);
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
