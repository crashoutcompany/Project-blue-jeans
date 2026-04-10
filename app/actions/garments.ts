"use server";

import { revalidateTag, updateTag } from "next/cache";

import { analyzeGarmentFromImageUrl } from "@/lib/ai/garments/describe-from-image";
import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { CLOSET_GARMENTS_TAG } from "@/lib/garments/get-closet-garments-cached";
import { requireSql } from "@/lib/db";
import {
  isGarmentCategoryDb,
  type GarmentCategoryDb,
} from "@/lib/garments/types";
import { safeClientMessage } from "@/lib/server/safe-client-error";

function revalidateClosetGarmentsCache() {
  updateTag(CLOSET_GARMENTS_TAG);
  // Clears `unstable_cache` entries (e.g. `loadGarmentsByIds`) that share this tag.
  revalidateTag(CLOSET_GARMENTS_TAG, "max");
}

const MAX_NAME_LEN = 200;
const MAX_COLOR_LEN = 120;
const MAX_NOTES_LEN = 4000;
const MAX_DESCRIPTION_LEN = 4000;

function canUseGemini(): boolean {
  return hasGeminiCredentials();
}

function fallbackGarmentDescription(
  displayName: string,
  category: GarmentCategoryDb,
): string {
  const n = displayName.trim() || "Garment";
  return `${n} (${category}). Add a richer description in the closet anytime for better outfit ideas.`;
}

async function resolveGarmentAiFields(
  item: CreateGarmentItemInput,
  displayName: string,
  descRaw: string,
  colorRaw: string,
): Promise<{ description: string; color: string | null }> {
  const hasDesc = descRaw.length > 0;
  const hasColor = colorRaw.length > 0;

  if (hasDesc && hasColor) {
    return {
      description: descRaw.slice(0, MAX_DESCRIPTION_LEN),
      color: colorRaw.slice(0, MAX_COLOR_LEN),
    };
  }

  if (!canUseGemini()) {
    return {
      description: hasDesc
        ? descRaw.slice(0, MAX_DESCRIPTION_LEN)
        : fallbackGarmentDescription(displayName, item.category),
      color: hasColor ? colorRaw.slice(0, MAX_COLOR_LEN) : null,
    };
  }

  try {
    const ai = await analyzeGarmentFromImageUrl({
      imageUrl: item.url.trim(),
      name: displayName,
      category: item.category,
      maxDescriptionLen: MAX_DESCRIPTION_LEN,
      maxColorLen: MAX_COLOR_LEN,
      fillDescription: !hasDesc,
      fillColor: !hasColor,
    });

    const description = hasDesc
      ? descRaw.slice(0, MAX_DESCRIPTION_LEN)
      : (ai.description.trim() ||
          fallbackGarmentDescription(displayName, item.category)).slice(
          0,
          MAX_DESCRIPTION_LEN,
        );

    const color = hasColor
      ? colorRaw.slice(0, MAX_COLOR_LEN)
      : ai.color.trim().length > 0
        ? ai.color.trim().slice(0, MAX_COLOR_LEN)
        : null;

    return { description, color };
  } catch {
    return {
      description: hasDesc
        ? descRaw.slice(0, MAX_DESCRIPTION_LEN)
        : fallbackGarmentDescription(displayName, item.category),
      color: hasColor ? colorRaw.slice(0, MAX_COLOR_LEN) : null,
    };
  }
}

export type CreateGarmentItemInput = {
  url: string;
  key: string;
  /** Display name from the add-to-closet form */
  name: string;
  category: GarmentCategoryDb;
  color?: string;
  notes?: string;
  /** Stylist / AI catalog copy for outfit generation */
  description?: string;
};

export type CreateGarmentsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createGarmentsFromUpload(
  items: CreateGarmentItemInput[],
): Promise<CreateGarmentsResult> {
  if (items.length === 0) return { ok: true };

  for (const item of items) {
    if (!item.url?.trim() || !item.key?.trim()) {
      return { ok: false, message: "Each item needs an image URL and key." };
    }
    if (!isGarmentCategoryDb(item.category)) {
      return { ok: false, message: "Invalid category." };
    }
  }

  try {
    const sql = requireSql();

    const rows = await Promise.all(
      items.map(async (item) => {
        const displayName =
          item.name.trim().slice(0, MAX_NAME_LEN) || "Untitled";
        const colorRaw = item.color?.trim().slice(0, MAX_COLOR_LEN) ?? "";
        const notesRaw = item.notes?.trim().slice(0, MAX_NOTES_LEN) ?? "";
        const descRaw =
          item.description?.trim().slice(0, MAX_DESCRIPTION_LEN) ?? "";
        const notes = notesRaw.length > 0 ? notesRaw : null;
        const { description, color } = await resolveGarmentAiFields(
          item,
          displayName,
          descRaw,
          colorRaw,
        );

        return {
          item,
          displayName,
          color,
          notes,
          description,
        };
      }),
    );

    for (const row of rows) {
      await sql`
        INSERT INTO garments (
          image_url,
          uploadthing_key,
          category,
          name,
          color,
          notes,
          description
        )
        VALUES (
          ${row.item.url.trim()},
          ${row.item.key.trim()},
          ${row.item.category},
          ${row.displayName},
          ${row.color},
          ${row.notes},
          ${row.description}
        )
      `;
    }
    revalidateClosetGarmentsCache();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "createGarmentsFromUpload",
        e,
        "Could not save your pieces. Try again in a moment.",
      ),
    };
  }
}

export type ToggleFavoriteResult =
  | { ok: true }
  | { ok: false; message: string };

export async function toggleGarmentFavorite(
  id: string,
): Promise<ToggleFavoriteResult> {
  try {
    const sql = requireSql();
    await sql`
      UPDATE garments
      SET
        is_favorite = NOT is_favorite,
        updated_at = now()
      WHERE id = ${id}
    `;
    revalidateClosetGarmentsCache();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "toggleGarmentFavorite",
        e,
        "Could not update that favorite. Try again in a moment.",
      ),
    };
  }
}
