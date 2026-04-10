"use server";

import { formatClosetCatalog } from "@/lib/ai/lookbook/catalog";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { loadGarmentCatalog, loadGarmentsByIds } from "@/lib/garments/load-catalog";
import { safeClientMessage } from "@/lib/server/safe-client-error";
import type { OutfitLook } from "@/lib/outfits/types";

export type GenerateLookbookInput = {
  climate: string;
  context: string;
  narrative: string;
  /**
   * When set and non-empty, only these closet garment ids are sent to the model.
   * Omit or leave empty to use the full closet (default).
   */
  includedGarmentIds?: string[];
  /** Number of looks (default 3 for generator UI; use 7 for weekly workflow step 1). */
  lookCount?: number;
  /** When true, step-1 prompt targets Mon–Sun planning. */
  weekly?: boolean;
  /** Skip step-2 hero image (e.g. weekly cron renders heroes separately). */
  skipHeroImage?: boolean;
};

export type GenerateLookbookResult =
  | { ok: true; looks: OutfitLook[]; curatorNote: string }
  | { ok: false; message: string };

const MAX_NARRATIVE = 2000;

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
  if (!hasGeminiCredentials()) {
    return {
      ok: false,
      message:
        "Missing Vertex credentials. Set GOOGLE_VERTEX_PROJECT and authenticate (see docs/vertex-ai-env.md).",
    };
  }

  const lookCount = input.lookCount ?? 3;
  const narrative = input.narrative.trim().slice(0, MAX_NARRATIVE);
  const climate = input.climate.trim().slice(0, 80);
  const context = input.context.trim().slice(0, 80);

  if (!climate || !context) {
    return { ok: false, message: "Climate and context are required." };
  }

  let garments = await loadGarmentCatalog();
  if (garments.length === 0) {
    return {
      ok: false,
      message: "Your closet is empty. Add garments before generating a lookbook.",
    };
  }

  const requestedIds = input.includedGarmentIds?.filter(Boolean);
  if (requestedIds && requestedIds.length > 0) {
    const allow = new Set(requestedIds);
    garments = garments.filter((g) => allow.has(g.id));
    if (garments.length === 0) {
      return {
        ok: false,
        message:
          "None of the selected pieces are in your closet. Refresh the page or adjust your selection.",
      };
    }
  }

  const validIds = new Set(garments.map((g) => g.id));
  const catalogText = formatClosetCatalog(garments);

  try {
    const plan = await runStep1PlanWithRetry({
      lookCount,
      climate,
      context,
      narrative,
      catalogText,
      validIds,
      weekly: input.weekly,
    });

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
