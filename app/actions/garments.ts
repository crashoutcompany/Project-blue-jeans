"use server";

import { revalidateTag, updateTag } from "next/cache";

import { CLOSET_GARMENTS_TAG } from "@/lib/garments/get-closet-garments-cached";
import { requireSql } from "@/lib/db";
import {
  isGarmentCategoryDb,
  type GarmentCategoryDb,
} from "@/lib/garments/types";

function revalidateClosetGarmentsCache() {
  updateTag(CLOSET_GARMENTS_TAG);
  // Clears `unstable_cache` entries (e.g. `loadGarmentsByIds`) that share this tag.
  revalidateTag(CLOSET_GARMENTS_TAG, "max");
}

const MAX_NAME_LEN = 200;
const MAX_COLOR_LEN = 120;
const MAX_NOTES_LEN = 4000;
const MAX_DESCRIPTION_LEN = 4000;

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
    for (const item of items) {
      const displayName =
        item.name.trim().slice(0, MAX_NAME_LEN) || "Untitled";
      const colorRaw = item.color?.trim().slice(0, MAX_COLOR_LEN) ?? "";
      const notesRaw = item.notes?.trim().slice(0, MAX_NOTES_LEN) ?? "";
      const descRaw =
        item.description?.trim().slice(0, MAX_DESCRIPTION_LEN) ?? "";
      const color = colorRaw.length > 0 ? colorRaw : null;
      const notes = notesRaw.length > 0 ? notesRaw : null;
      const description = descRaw.length > 0 ? descRaw : "";

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
          ${item.url.trim()},
          ${item.key.trim()},
          ${item.category},
          ${displayName},
          ${color},
          ${notes},
          ${description}
        )
      `;
    }
    revalidateClosetGarmentsCache();
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not save to the database.";
    return { ok: false, message };
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
    const message =
      e instanceof Error ? e.message : "Could not update favorite.";
    return { ok: false, message };
  }
}
