import { getSql, requireSql } from "@/lib/db";
import type { MembershipPolicy } from "@/lib/auth/membership";
import { getOwnedMediaAsset } from "@/lib/media/assets";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import { logServerError } from "@/lib/server/safe-client-error";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";
import { resolveUploadThingTokenForConnection } from "@/lib/credentials/resolve";

export type WearerPhoto = {
  imageUrl: string;
  uploadthingKey: string | null;
  mediaAssetId: string | null;
};

function uploadthingKeyOf(
  row: { uploadthing_key?: string | null } | undefined,
): string | null {
  return row?.uploadthing_key?.trim() || null;
}

/** Current Wearer photo for an account, or null if unset / DB unavailable. */
export async function getWearerPhoto(
  userId: string,
): Promise<WearerPhoto | null> {
  const sql = getSql();
  if (!sql || !userId) return null;
  try {
    const rows = (await sql`
      SELECT image_url, uploadthing_key, media_asset_id
      FROM wearer_profile
      WHERE user_id = ${userId}
      LIMIT 1
    `) as {
      image_url: string;
      uploadthing_key: string | null;
      media_asset_id: string | null;
    }[];
    const row = rows[0];
    if (!row?.image_url && !row?.media_asset_id) return null;
    const mediaAssetId = row.media_asset_id?.trim() || null;
    return {
      imageUrl: mediaAssetId
        ? mediaAssetDisplayPath(mediaAssetId)
        : row.image_url,
      uploadthingKey: row.uploadthing_key,
      mediaAssetId,
    };
  } catch (e) {
    console.error("[wearer] getWearerPhoto failed", e);
    return null;
  }
}

export async function saveWearerPhoto(input: {
  userId: string;
  mediaAssetId: string;
  membership?: MembershipPolicy | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.userId) {
    return { ok: false, message: "Missing user id." };
  }
  const asset = await getOwnedMediaAsset(input.userId, input.mediaAssetId);
  if (!asset || asset.kind !== "wearer_photo") {
    return { ok: false, message: "That upload could not be found." };
  }

  try {
    const sql = requireSql();
    const existing = (await sql`
      SELECT uploadthing_key, media_asset_id
      FROM wearer_profile
      WHERE user_id = ${input.userId}
      LIMIT 1
    `) as {
      uploadthing_key: string | null;
      media_asset_id: string | null;
    }[];
    const previousKey = uploadthingKeyOf(existing[0]);
    const previousAssetId = existing[0]?.media_asset_id?.trim() || null;
    const displayUrl = mediaAssetDisplayPath(asset.id);

    await sql`
      INSERT INTO wearer_profile (
        user_id,
        image_url,
        uploadthing_key,
        media_asset_id,
        updated_at
      )
      VALUES (
        ${input.userId},
        ${displayUrl},
        ${asset.providerFileKey},
        ${asset.id}::uuid,
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        uploadthing_key = EXCLUDED.uploadthing_key,
        media_asset_id = EXCLUDED.media_asset_id,
        updated_at = now()
    `;

    if (previousKey && previousKey !== asset.providerFileKey) {
      const previous = previousAssetId
        ? await getOwnedMediaAsset(input.userId, previousAssetId)
        : null;
      const resolved = await resolveUploadThingTokenForConnection(
        input.userId,
        previous?.connectionId ?? asset.connectionId,
        input.membership,
      );
      const deleted = await deleteUploadThingFiles(
        [previousKey],
        resolved.ok ? resolved.token : null,
      );
      if (previousAssetId && previousAssetId !== asset.id && deleted) {
        await sql`
          DELETE FROM media_assets
          WHERE id = ${previousAssetId}::uuid
            AND user_id = ${input.userId}
        `;
      }
    } else if (previousAssetId && previousAssetId !== asset.id) {
      await sql`
        DELETE FROM media_assets
        WHERE id = ${previousAssetId}::uuid
          AND user_id = ${input.userId}
      `;
    }
    return { ok: true };
  } catch (e) {
    logServerError("saveWearerPhoto", e);
    return { ok: false, message: "Could not save your photo. Try again." };
  }
}

export async function clearWearerPhoto(
  userId: string,
  membership?: MembershipPolicy | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }
  try {
    const sql = requireSql();
    const deleted = (await sql`
      DELETE FROM wearer_profile
      WHERE user_id = ${userId}
      RETURNING uploadthing_key, media_asset_id
    `) as {
      uploadthing_key: string | null;
      media_asset_id: string | null;
    }[];
    const previousKey = uploadthingKeyOf(deleted[0]);
    const previousAssetId = deleted[0]?.media_asset_id?.trim() || null;
    if (previousKey) {
      const previous = previousAssetId
        ? await getOwnedMediaAsset(userId, previousAssetId)
        : null;
      const resolved = await resolveUploadThingTokenForConnection(
        userId,
        previous?.connectionId ?? null,
        membership,
      );
      const deleted = await deleteUploadThingFiles(
        [previousKey],
        resolved.ok ? resolved.token : null,
      );
      if (previousAssetId && deleted) {
        await sql`
          DELETE FROM media_assets
          WHERE id = ${previousAssetId}::uuid
            AND user_id = ${userId}
        `;
      }
    } else if (previousAssetId) {
      await sql`
        DELETE FROM media_assets
        WHERE id = ${previousAssetId}::uuid
          AND user_id = ${userId}
      `;
    }
    return { ok: true };
  } catch (e) {
    logServerError("clearWearerPhoto", e);
    return { ok: false, message: "Could not remove your photo. Try again." };
  }
}
