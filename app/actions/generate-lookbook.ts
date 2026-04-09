"use server";

import { formatClosetCatalog } from "@/lib/ai/lookbook/catalog";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { runOutfitPlanStep } from "@/lib/ai/lookbook/step1-plan";
import {
  filterPlanToValidGarmentIds,
  planHasEmptyGarmentIds,
} from "@/lib/ai/lookbook/validate-ids";
import { loadGarmentCatalog, loadGarmentsByIds } from "@/lib/garments/load-catalog";
import type { OutfitLook } from "@/lib/mock/types";

export type GenerateLookbookInput = {
  climate: string;
  context: string;
  narrative: string;
  /** Number of looks (default 3 for generator UI; use 7 for weekly workflow step 1). */
  lookCount?: number;
  /** When true, step-1 prompt targets Mon–Sun planning. */
  weekly?: boolean;
  /** Skip step-2 hero image (weekly workflow uses Batch API for images). */
  skipHeroImage?: boolean;
};

export type GenerateLookbookResult =
  | { ok: true; looks: OutfitLook[]; curatorNote: string }
  | { ok: false; message: string };

const MAX_NARRATIVE = 2000;

function requireGoogleKey(): string | null {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

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
 * Shared orchestration: catalog → structured plan → optional hero image (first look only).
 * Used by the generator UI and by the weekly workflow (with different `lookCount` / `weekly`).
 */
export async function generateLookbook(
  input: GenerateLookbookInput,
): Promise<GenerateLookbookResult> {
  const apiKey = requireGoogleKey();
  if (!apiKey) {
    return {
      ok: false,
      message:
        "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add it to your environment to enable generation.",
    };
  }

  const lookCount = input.lookCount ?? 3;
  const narrative = input.narrative.trim().slice(0, MAX_NARRATIVE);
  const climate = input.climate.trim().slice(0, 80);
  const context = input.context.trim().slice(0, 80);

  if (!climate || !context) {
    return { ok: false, message: "Climate and context are required." };
  }

  const garments = await loadGarmentCatalog();
  if (garments.length === 0) {
    return {
      ok: false,
      message: "Your closet is empty. Add garments before generating a lookbook.",
    };
  }

  const validIds = new Set(garments.map((g) => g.id));
  const catalogText = formatClosetCatalog(garments);

  try {
    let plan = await runOutfitPlanStep({
      lookCount,
      climate,
      context,
      narrative,
      catalogText,
      weekly: input.weekly,
    });

    plan = filterPlanToValidGarmentIds(plan, validIds);

    if (planHasEmptyGarmentIds(plan)) {
      plan = await runOutfitPlanStep({
        lookCount,
        climate,
        context,
        narrative:
          narrative +
          `\n\nIMPORTANT: You must only output garmentIds that appear in this exact list: ${[...validIds].join(", ")}`,
        catalogText,
        weekly: input.weekly,
      });
      plan = filterPlanToValidGarmentIds(plan, validIds);
    }

    if (planHasEmptyGarmentIds(plan)) {
      return {
        ok: false,
        message:
          "The model returned garment ids that do not match your closet. Try again or improve descriptions.",
      };
    }

    const baseId = `gen-${Date.now()}`;
    const looks = buildOutfitLooks(plan, baseId);

    if (!input.skipHeroImage) {
      const hero = looks[0]!;
      const rows = await loadGarmentsByIds(hero.garmentIds ?? []);
      const idOrder = new Map(hero.garmentIds?.map((id, i) => [id, i]) ?? []);
      rows.sort(
        (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
      );

      let heroImage: string | undefined;
      try {
        heroImage = await runHeroImageStep({
          title: hero.title,
          description: hero.description,
          climate,
          context,
          narrative,
          garments: rows.map((r) => ({
            id: r.id,
            category: r.category,
            name: r.name,
            imageUrl: r.image_url,
          })),
        });
      } catch {
        // Image is optional
      }

      if (heroImage) {
        looks[0] = { ...looks[0]!, imageDataUrl: heroImage };
      }
    }

    const curatorNote =
      plan.curatorNote?.trim() ||
      "Here are directions that honor your climate, context, and closet—refine any look with a follow-up prompt later.";

    return { ok: true, looks, curatorNote };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Generation failed. Try again shortly.";
    return { ok: false, message };
  }
}
