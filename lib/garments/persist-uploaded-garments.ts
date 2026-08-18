import { analyzeGarmentFromImageUrl } from "@/lib/ai/garments/describe-from-image";
import type { MembershipPolicy } from "@/lib/auth/membership";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { GARMENT_FIELD_LIMITS } from "@/lib/garments/field-limits";
import {
  isGarmentCategoryDb,
  type GarmentCategoryDb,
} from "@/lib/garments/types";
import { safeClientMessage } from "@/lib/server/safe-client-error";

const MAX_NAME_LEN = GARMENT_FIELD_LIMITS.name;
const MAX_COLOR_LEN = GARMENT_FIELD_LIMITS.color;
const MAX_NOTES_LEN = GARMENT_FIELD_LIMITS.notes;
const MAX_DESCRIPTION_LEN = GARMENT_FIELD_LIMITS.description;
/** Cap parallel Gemini describe calls so a 24-file batch stays within route time limits. */
const AI_DESCRIBE_CONCURRENCY = 3;

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
  apiKey: string | null,
): Promise<{ description: string; color: string | null }> {
  const hasDesc = descRaw.length > 0;
  const hasColor = colorRaw.length > 0;

  if (hasDesc && hasColor) {
    return {
      description: descRaw.slice(0, MAX_DESCRIPTION_LEN),
      color: colorRaw.slice(0, MAX_COLOR_LEN),
    };
  }

  if (!apiKey) {
    return {
      description: hasDesc
        ? descRaw.slice(0, MAX_DESCRIPTION_LEN)
        : fallbackGarmentDescription(displayName, item.category),
      color: hasColor ? colorRaw.slice(0, MAX_COLOR_LEN) : null,
    };
  }

  try {
    const ai = await analyzeGarmentFromImageUrl({
      apiKey,
      imageUrl: item.url.trim(),
      name: displayName,
      category: item.category,
      notes: item.notes,
      maxNameLen: MAX_NAME_LEN,
      maxDescriptionLen: MAX_DESCRIPTION_LEN,
      maxColorLen: MAX_COLOR_LEN,
      fillName: false,
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
  membership?: MembershipPolicy | null,
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
    const needsAi = items.some((item) => {
      const hasDesc = Boolean(
        item.description?.trim().slice(0, MAX_DESCRIPTION_LEN),
      );
      const hasColor = Boolean(item.color?.trim().slice(0, MAX_COLOR_LEN));
      return !hasDesc || !hasColor;
    });
    const gemini = needsAi
      ? await resolveGeminiApiKey(userId, membership)
      : { ok: false as const, message: "" };
    const apiKey = gemini.ok ? gemini.apiKey : null;

    const rows = await mapWithConcurrency(
      items,
      AI_DESCRIBE_CONCURRENCY,
      async (item) => {
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
          apiKey,
        );

        return {
          item,
          displayName,
          color,
          notes,
          description,
        };
      },
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
