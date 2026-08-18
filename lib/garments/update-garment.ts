import { analyzeGarmentFromImageUrl } from "@/lib/ai/garments/describe-from-image";
import type { MembershipPolicy } from "@/lib/auth/membership";
import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { GARMENT_FIELD_LIMITS } from "@/lib/garments/field-limits";
import { garmentRowToCardData, type GarmentRow } from "@/lib/garments/map-row";
import {
  isGarmentCategoryDb,
  type GarmentCategoryDb,
  type UpdateGarmentFieldsResult,
} from "@/lib/garments/types";
import { resolveOwnedImageFetchUrl } from "@/lib/media/owned-image";
import { safeClientMessage } from "@/lib/server/safe-client-error";

export { GARMENT_FIELD_LIMITS } from "@/lib/garments/field-limits";
export type { UpdateGarmentFieldsResult } from "@/lib/garments/types";

const MAX_NAME_LEN = GARMENT_FIELD_LIMITS.name;
const MAX_COLOR_LEN = GARMENT_FIELD_LIMITS.color;
const MAX_NOTES_LEN = GARMENT_FIELD_LIMITS.notes;
const MAX_DESCRIPTION_LEN = GARMENT_FIELD_LIMITS.description;

/** Stay under route `maxDuration` (60s) so the client gets a JSON error, not a gateway cut. */
const AI_UPDATE_TIMEOUT_MS = 45_000;

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

/**
 * Persist closet garment field edits for one Wearer. Caller handles auth + cache.
 * When AI regenerate flags are set, product URLs in notes are read via Gemini
 * url_context on the vision call.
 */
export async function updateGarmentFields(
  userId: string,
  input: UpdateGarmentFieldsInput,
  membership?: MembershipPolicy | null,
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

    if (fillName || fillDescription) {
      const gemini = await resolveGeminiApiKey(userId, membership);
      if (!gemini.ok) {
        return {
          ok: false,
          message: gemini.message,
        };
      }

      const existing = (await sql`
        SELECT
          id,
          image_url,
          uploadthing_key,
          media_asset_id,
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

      const abortSignal = AbortSignal.timeout(AI_UPDATE_TIMEOUT_MS);
      try {
        const imageUrl = await resolveOwnedImageFetchUrl(userId, {
          mediaAssetId: row.media_asset_id,
          imageUrl: row.image_url,
        });
        if (!imageUrl) {
          return { ok: false, message: "Could not load that photo." };
        }
        const ai = await analyzeGarmentFromImageUrl({
          apiKey: gemini.apiKey,
          imageUrl,
          name,
          category: input.category,
          notes,
          maxNameLen: MAX_NAME_LEN,
          maxDescriptionLen: MAX_DESCRIPTION_LEN,
          maxColorLen: MAX_COLOR_LEN,
          fillName,
          fillDescription,
          fillColor: !color,
          abortSignal,
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
        media_asset_id,
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
