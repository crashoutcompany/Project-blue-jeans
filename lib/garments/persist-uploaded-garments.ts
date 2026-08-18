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
import { claimOwnedMediaAssets } from "@/lib/media/assets";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import { resolveOwnedImageFetchUrl } from "@/lib/media/owned-image";
import { safeClientMessage } from "@/lib/server/safe-client-error";

const MAX_NAME_LEN = GARMENT_FIELD_LIMITS.name;
const MAX_COLOR_LEN = GARMENT_FIELD_LIMITS.color;
const MAX_NOTES_LEN = GARMENT_FIELD_LIMITS.notes;
const MAX_DESCRIPTION_LEN = GARMENT_FIELD_LIMITS.description;
/** Cap parallel Gemini describe calls so a 24-file batch stays within route time limits. */
const AI_DESCRIBE_CONCURRENCY = 3;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fallbackGarmentDescription(
  displayName: string,
  category: GarmentCategoryDb,
): string {
  const n = displayName.trim() || "Garment";
  return `${n} (${category}). Add a richer description in the closet anytime for better outfit ideas.`;
}

export type CreateGarmentItemInput = {
  mediaAssetId: string;
  name: string;
  category: GarmentCategoryDb;
  color?: string;
  notes?: string;
  description?: string;
};

export type CreateGarmentsResult =
  | { ok: true }
  | { ok: false; message: string };

async function resolveGarmentAiFields(input: {
  userId: string;
  mediaAssetId: string;
  category: GarmentCategoryDb;
  displayName: string;
  descRaw: string;
  colorRaw: string;
  notes: string | null;
  apiKey: string | null;
}): Promise<{ description: string; color: string | null }> {
  const hasDesc = input.descRaw.length > 0;
  const hasColor = input.colorRaw.length > 0;

  if (hasDesc && hasColor) {
    return {
      description: input.descRaw.slice(0, MAX_DESCRIPTION_LEN),
      color: input.colorRaw.slice(0, MAX_COLOR_LEN),
    };
  }

  if (!input.apiKey) {
    return {
      description: hasDesc
        ? input.descRaw.slice(0, MAX_DESCRIPTION_LEN)
        : fallbackGarmentDescription(input.displayName, input.category),
      color: hasColor ? input.colorRaw.slice(0, MAX_COLOR_LEN) : null,
    };
  }

  const imageUrl = await resolveOwnedImageFetchUrl(input.userId, {
    mediaAssetId: input.mediaAssetId,
  });
  if (!imageUrl) {
    return {
      description: hasDesc
        ? input.descRaw.slice(0, MAX_DESCRIPTION_LEN)
        : fallbackGarmentDescription(input.displayName, input.category),
      color: hasColor ? input.colorRaw.slice(0, MAX_COLOR_LEN) : null,
    };
  }

  try {
    const ai = await analyzeGarmentFromImageUrl({
      apiKey: input.apiKey,
      imageUrl,
      name: input.displayName,
      category: input.category,
      notes: input.notes,
      maxNameLen: MAX_NAME_LEN,
      maxDescriptionLen: MAX_DESCRIPTION_LEN,
      maxColorLen: MAX_COLOR_LEN,
      fillName: false,
      fillDescription: !hasDesc,
      fillColor: !hasColor,
    });

    const description = hasDesc
      ? input.descRaw.slice(0, MAX_DESCRIPTION_LEN)
      : (
          ai.description.trim() ||
          fallbackGarmentDescription(input.displayName, input.category)
        ).slice(0, MAX_DESCRIPTION_LEN);

    const color = hasColor
      ? input.colorRaw.slice(0, MAX_COLOR_LEN)
      : ai.color.trim().length > 0
        ? ai.color.trim().slice(0, MAX_COLOR_LEN)
        : null;

    return { description, color };
  } catch {
    return {
      description: hasDesc
        ? input.descRaw.slice(0, MAX_DESCRIPTION_LEN)
        : fallbackGarmentDescription(input.displayName, input.category),
      color: hasColor ? input.colorRaw.slice(0, MAX_COLOR_LEN) : null,
    };
  }
}

/**
 * Inserts garment rows from owned media assets. Caller handles auth and cache.
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
    if (!UUID_RE.test(item.mediaAssetId?.trim() ?? "")) {
      return { ok: false, message: "Each item needs a media id." };
    }
    if (!isGarmentCategoryDb(item.category)) {
      return { ok: false, message: "Invalid category." };
    }
  }

  const claimed = await claimOwnedMediaAssets({
    userId,
    mediaAssetIds: items.map((item) => item.mediaAssetId.trim()),
    kind: "closet_image",
  });
  if (!claimed.ok) return claimed;
  const assetById = new Map(claimed.assets.map((asset) => [asset.id, asset]));

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
        const { description, color } = await resolveGarmentAiFields({
          userId,
          mediaAssetId: item.mediaAssetId.trim(),
          category: item.category,
          displayName,
          descRaw,
          colorRaw,
          notes,
          apiKey,
        });
        const asset = assetById.get(item.mediaAssetId.trim())!;

        return {
          item,
          asset,
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
          media_asset_id,
          category,
          name,
          color,
          notes,
          description,
          user_id
        )
        VALUES (
          ${mediaAssetDisplayPath(row.asset.id)},
          ${row.asset.providerFileKey},
          ${row.asset.id}::uuid,
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
