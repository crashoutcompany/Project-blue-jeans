import { analyzeGarmentFromImageUrl } from "@/lib/ai/garments/describe-from-image";
import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { requireSql } from "@/lib/db";
import {
  isGarmentCategoryDb,
  type GarmentCategoryDb,
} from "@/lib/garments/types";
import { safeClientMessage } from "@/lib/server/safe-client-error";

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
      : (
          ai.description.trim() ||
          fallbackGarmentDescription(displayName, item.category)
        ).slice(0, MAX_DESCRIPTION_LEN);

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
  name: string;
  category: GarmentCategoryDb;
  color?: string;
  notes?: string;
  description?: string;
};

export type CreateGarmentsResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Inserts garment rows from UploadThing URLs/keys. Caller handles auth and cache revalidation.
 */
export async function persistUploadedGarmentItems(
  userId: string,
  items: CreateGarmentItemInput[],
): Promise<CreateGarmentsResult> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }
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

    const inserts = rows.map(
      (row) => sql`
        INSERT INTO garments (
          image_url,
          uploadthing_key,
          category,
          name,
          color,
          notes,
          description,
          user_id
        )
        VALUES (
          ${row.item.url.trim()},
          ${row.item.key.trim()},
          ${row.item.category},
          ${row.displayName},
          ${row.color},
          ${row.notes},
          ${row.description},
          ${userId}
        )
      `,
    );
    if (typeof sql.transaction === "function") {
      await sql.transaction(inserts);
    } else {
      for (const q of inserts) {
        await q;
      }
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "persistUploadedGarmentItems",
        e,
        "Could not save your pieces. Try again in a moment.",
      ),
    };
  }
}
