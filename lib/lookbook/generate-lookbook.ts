import { formatClosetCatalog } from "@/lib/ai/lookbook/catalog";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { resolveOutfitLocation } from "@/lib/ai/weather/constants";
import type { MembershipPolicy } from "@/lib/auth/membership";
import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { MAX_NARRATIVE_LEN } from "@/lib/garments/field-limits";
import {
  loadGarmentCatalog,
  loadGarmentsByIds,
} from "@/lib/garments/load-catalog";
import {
  resolveGarmentImageSourcesForAi,
  resolveOwnedImageFetchUrl,
} from "@/lib/media/owned-image";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import {
  existingHeroForGarments,
  findExistingOutfitHeroUrls,
} from "@/lib/outfits/existing-outfit-heroes";
import {
  catalogCanFormLook,
  categoryByIdFromCatalog,
  countLookSlots,
  isWeeklyUniqueCategory,
  lookContainsAll,
  lookStackError,
  validateIncludeAvoidPair,
  validateMustWearIncludes,
} from "@/lib/outfits/look-composition";
import type { OutfitLook } from "@/lib/outfits/types";
import { safeClientMessage } from "@/lib/server/safe-client-error";
import {
  addDaysIso,
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { getWearerLocation } from "@/lib/wearer/preferences";
import { getWearerPhoto } from "@/lib/wearer/profile";

const DEFAULT_CLIMATE = "Temperate";
const DEFAULT_CONTEXT = "Versatile day-to-night";

export type GenerateLookbookInput = {
  userId: string;
  membership?: MembershipPolicy | null;
  climate?: string;
  context?: string;
  /** Override default weather location (New York, NY) when set. */
  location?: string;
  narrative: string;
  includedGarmentIds?: string[];
  avoidedGarmentIds?: string[];
  lookCount?: number;
  weekly?: boolean;
  skipHeroImage?: boolean;
};

export type GenerateLookbookResult =
  | { ok: true; looks: OutfitLook[]; curatorNote: string }
  | { ok: false; message: string };

function buildOutfitLooks(
  plan: import("@/lib/ai/lookbook/schemas").LookbookPlan,
  baseId: string,
): OutfitLook[] {
  return plan.looks.map((look, index) => ({
    id: `${baseId}-${index}`,
    title: look.title,
    description: look.description,
    tags:
      index === 0
        ? Array.from(new Set([...look.tags, "Prime pick"]))
        : look.tags,
    featured: index === 0,
    garmentIds: look.garmentIds,
  }));
}

/**
 * Catalog → structured plan → optional hero images (one per look, in parallel).
 * Reuses a stored Outfit hero when the same garment set already exists.
 * Used by the generator API and any server workflows.
 */
export async function generateLookbook(
  input: GenerateLookbookInput,
): Promise<GenerateLookbookResult> {
  if (!input.userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const gemini = await resolveGeminiApiKey(input.userId, input.membership);
  if (!gemini.ok) {
    return { ok: false, message: gemini.message };
  }

  const rawLookCount = input.lookCount ?? 3;
  const lookCount = Number.isFinite(rawLookCount)
    ? Math.min(3, Math.max(1, Math.floor(rawLookCount)))
    : 3;
  const narrative = input.narrative.trim().slice(0, MAX_NARRATIVE_LEN);
  const climate = (input.climate?.trim() || DEFAULT_CLIMATE).slice(0, 80);
  const context = (input.context?.trim() || DEFAULT_CONTEXT).slice(0, 80);
  const storedLocation = input.location?.trim()
    ? input.location
    : await getWearerLocation(input.userId);
  const location = resolveOutfitLocation(storedLocation);

  let garments = await loadGarmentCatalog(input.userId);
  if (garments.length === 0) {
    return {
      ok: false,
      message:
        "Your closet is empty. Add garments before generating a lookbook.",
    };
  }

  const todayIso = productTodayIso();
  const weekStart = sundayWeekStartIso(todayIso);
  const weekEnd = addDaysIso(weekStart, 6);
  const committedOutfits = input.weekly
    ? []
    : await loadOutfitsInRange(input.userId, weekStart, weekEnd).catch(() => []);
  const categoryById = categoryByIdFromCatalog(garments);
  const committedTopIds = new Set<string>();
  for (const outfit of committedOutfits) {
    for (const id of outfit.garmentIds) {
      if (isWeeklyUniqueCategory(categoryById.get(id) ?? "")) {
        committedTopIds.add(id);
      }
    }
  }

  const avoided = new Set(
    (input.avoidedGarmentIds ?? []).filter((id) => categoryById.has(id)),
  );
  const included = [...new Set((input.includedGarmentIds ?? []).filter(Boolean))];

  const pairError = validateIncludeAvoidPair(included, [...avoided]);
  if (pairError) return { ok: false, message: pairError };

  garments = garments.filter((g) => {
    if (avoided.has(g.id)) return false;
    if (committedTopIds.has(g.id) && !included.includes(g.id)) return false;
    return true;
  });

  if (included.length > 0) {
    const includeError = validateMustWearIncludes(
      included,
      categoryByIdFromCatalog(garments),
    );
    if (includeError) return { ok: false, message: includeError };
    for (const id of included) {
      if (committedTopIds.has(id)) {
        return {
          ok: false,
          message:
            "That top is already on a committed Outfit this week. Unwear it first or pick another piece.",
        };
      }
    }
  }

  if (!catalogCanFormLook(garments)) {
    return {
      ok: false,
      message:
        "Add at least one top, one bottom, and one pair of shoes before generating.",
    };
  }

  const validIds = new Set(garments.map((g) => g.id));
  const catalogText = formatClosetCatalog(garments);
  const mustWearNames = included.map(
    (id) => garments.find((g) => g.id === id)?.name?.trim() || id,
  );

  try {
    const plan = await runStep1PlanWithRetry({
      apiKey: gemini.apiKey,
      lookCount,
      climate,
      context,
      narrative,
      catalogText,
      validIds,
      location,
      weekly: input.weekly,
      mustWearIds: included.length > 0 ? included : undefined,
      mustWearNames: included.length > 0 ? mustWearNames : undefined,
    });

    const liveCategoryById = categoryByIdFromCatalog(garments);
    for (const look of plan.looks) {
      const stackErr = lookStackError(
        countLookSlots(look.garmentIds, liveCategoryById),
      );
      if (stackErr) {
        return { ok: false, message: stackErr };
      }
      if (!lookContainsAll(look.garmentIds, included)) {
        return {
          ok: false,
          message: "Every look must include the pieces you pinned.",
        };
      }
    }

    const baseId = `gen-${Date.now()}`;
    const looks = buildOutfitLooks(plan, baseId);

    if (!input.skipHeroImage) {
      const [existingHeroes, wearerPhoto] = await Promise.all([
        findExistingOutfitHeroUrls(
          input.userId,
          looks.map((look) => look.garmentIds ?? []),
        ),
        getWearerPhoto(input.userId).catch(() => null),
      ]);
      const needsGeneratedHero = looks.some(
        (look) => !existingHeroForGarments(existingHeroes, look.garmentIds),
      );
      const wearer = needsGeneratedHero ? wearerPhoto : null;

      const heroImages = await Promise.all(
        looks.map(async (look) => {
          const reused = existingHeroForGarments(
            existingHeroes,
            look.garmentIds,
          );
          if (reused) return reused;

          try {
            const rows = await loadGarmentsByIds(
              input.userId,
              look.garmentIds ?? [],
            );
            const idOrder = new Map(
              look.garmentIds?.map((id, i) => [id, i]) ?? [],
            );
            rows.sort(
              (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
            );
            if (rows.length === 0) return undefined;

            const garments = await resolveGarmentImageSourcesForAi(
              input.userId,
              rows,
              input.membership,
            );
            if (garments.length === 0) return undefined;

            const wearerPhotoUrl = wearer
              ? await resolveOwnedImageFetchUrl(
                  input.userId,
                  {
                    mediaAssetId: wearer.mediaAssetId,
                    imageUrl: wearer.imageUrl,
                  },
                  input.membership,
                )
              : null;

            return await runHeroImageStep({
              apiKey: gemini.apiKey,
              title: look.title,
              description: look.description,
              climate,
              context,
              narrative,
              garments,
              wearerPhotoUrl,
            });
          } catch {
            // Image is optional per look
            return undefined;
          }
        }),
      );

      for (let i = 0; i < looks.length; i++) {
        const image = heroImages[i];
        if (image) {
          looks[i] = { ...looks[i]!, imageDataUrl: image };
        }
      }
    }

    const curatorNote =
      plan.curatorNote?.trim() ||
      "Here are directions that honor your climate, context, and closet—refine any look with a follow-up prompt later.";

    return { ok: true, looks, curatorNote };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "generateLookbook",
        e,
        "We could not generate your lookbook. Try again in a moment.",
      ),
    };
  }
}
