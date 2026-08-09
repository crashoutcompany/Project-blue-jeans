import { analyzeGarmentFromImageUrl } from "@/lib/ai/garments/describe-from-image";
import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { requireSql } from "@/lib/db";
import { garmentRowToCardData, type GarmentRow } from "@/lib/garments/map-row";
import {
  isGarmentCategoryDb,
  type ClothingCardData,
  type GarmentCategoryDb,
} from "@/lib/garments/types";
import { safeClientMessage } from "@/lib/server/safe-client-error";

const MAX_NAME_LEN = 200;
const MAX_COLOR_LEN = 120;
const MAX_NOTES_LEN = 4000;
const MAX_DESCRIPTION_LEN = 4000;

export type UpdateGarmentFieldsInput = {
  id: string;
  name: string;
  category: GarmentCategoryDb;
  color: string;
  notes: string;
  description: string;
  /** When true, rewrite name from photo (+ product URLs in notes). */
  regenerateNameWithAi?: boolean;
  /** When true, rewrite description from photo (+ product URLs in notes). */
  regenerateDescriptionWithAi?: boolean;
};

export type UpdateGarmentFieldsResult =
  | { ok: true; garment: ClothingCardData }
  | { ok: false; message: string };

/**
 * Persist closet garment field edits for one Wearer. Caller handles auth + cache.
 * When AI regenerate flags are set, product URLs in notes are fetched server-side
 * and included as text context for the vision call.
 */
export async function updateGarmentFields(
  userId: string,
  input: UpdateGarmentFieldsInput,
): Promise<UpdateGarmentFieldsResult> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id || id.startsWith("pending:")) {
    return { ok: false, message: "Invalid garment." };
  }
  if (!isGarmentCategoryDb(input.category)) {
    return { ok: false, message: "Invalid category." };
  }

  let name = input.name.trim().slice(0, MAX_NAME_LEN) || "Untitled";
  const colorRaw = input.color.trim().slice(0, MAX_COLOR_LEN);
  const notesRaw = input.notes.trim().slice(0, MAX_NOTES_LEN);
  const notes = notesRaw.length > 0 ? notesRaw : null;
  let description = input.description.trim().slice(0, MAX_DESCRIPTION_LEN);
  let color: string | null = colorRaw.length > 0 ? colorRaw : null;

  const fillName = Boolean(input.regenerateNameWithAi);
  const fillDescription = Boolean(input.regenerateDescriptionWithAi);

  try {
    const sql = requireSql();
    const existing = (await sql`
      SELECT
        id,
        image_url,
        uploadthing_key,
        category::text AS category,
        color,
        is_favorite,
        name,
        notes,
        description
      FROM garments
      WHERE id = ${id}
        AND user_id = ${userId}
      LIMIT 1
    `) as GarmentRow[];

    const row = existing[0];
    if (!row) {
      return { ok: false, message: "Garment not found." };
    }

    if (fillName || fillDescription) {
      if (!hasGeminiCredentials()) {
        return {
          ok: false,
          message:
            "Missing Vertex credentials. Set GOOGLE_VERTEX_PROJECT and authenticate (see docs/vertex-ai-env.md).",
        };
      }
      try {
        const ai = await analyzeGarmentFromImageUrl({
          imageUrl: row.image_url,
          name,
          category: input.category,
          notes,
          maxNameLen: MAX_NAME_LEN,
          maxDescriptionLen: MAX_DESCRIPTION_LEN,
          maxColorLen: MAX_COLOR_LEN,
          fillName,
          fillDescription,
          fillColor: !color,
        });
        if (fillName) {
          name = ai.name.trim() || name;
        }
        if (fillDescription) {
          description =
            ai.description.trim() ||
            description ||
            `${name} (${input.category}).`;
        }
        if (!color && ai.color.trim()) {
          color = ai.color.trim().slice(0, MAX_COLOR_LEN);
        }
      } catch (e) {
        return {
          ok: false,
          message: safeClientMessage(
            "updateGarmentFields.ai",
            e,
            "Could not regenerate with AI. Check the product link or try again.",
          ),
        };
      }
    }

    const updated = (await sql`
      UPDATE garments
      SET
        name = ${name},
        category = ${input.category},
        color = ${color},
        notes = ${notes},
        description = ${description},
        updated_at = now()
      WHERE id = ${id}
        AND user_id = ${userId}
      RETURNING
        id,
        image_url,
        uploadthing_key,
        category::text AS category,
        color,
        is_favorite,
        name,
        notes,
        description
    `) as GarmentRow[];

    const next = updated[0];
    if (!next) {
      return { ok: false, message: "Garment not found." };
    }

    return { ok: true, garment: garmentRowToCardData(next) };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "updateGarmentFields",
        e,
        "Could not save that piece. Try again in a moment.",
      ),
    };
  }
}
