import "server-only";

import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { insertLegacyMediaAsset } from "@/lib/media/assets";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import { ensurePlatformUploadThingConnection } from "@/lib/media/platform-connection";
import { makeUploadThingFilesPrivate } from "@/lib/media/uploadthing-api";
import { logServerError } from "@/lib/server/safe-client-error";

type LegacyFileRow = {
  id: string;
  uploadthing_key: string | null;
  table: "garments" | "wearer_profile";
};

/**
 * Bind existing UploadThing keys to media_assets and switch ACL to private
 * where the API accepts the change. Unreachable files are left as-is.
 */
export async function sealLegacyUploadThingMedia(userId: string): Promise<void> {
  const resolved = await resolveUploadThingToken(userId);
  if (!resolved.ok) return;

  const connectionId =
    resolved.connectionId ??
    (resolved.source === "platform_env"
      ? await ensurePlatformUploadThingConnection({
          userId,
          token: resolved.token,
        })
      : null);

  const sql = requireSql();
  const garmentRows = (await sql`
    SELECT id::text AS id, uploadthing_key
    FROM garments
    WHERE user_id = ${userId}
      AND media_asset_id IS NULL
      AND uploadthing_key IS NOT NULL
      AND uploadthing_key <> ''
  `) as Array<{ id: string; uploadthing_key: string | null }>;

  const wearerRows = (await sql`
    SELECT user_id AS id, uploadthing_key
    FROM wearer_profile
    WHERE user_id = ${userId}
      AND media_asset_id IS NULL
      AND uploadthing_key IS NOT NULL
      AND uploadthing_key <> ''
  `) as Array<{ id: string; uploadthing_key: string | null }>;

  const legacy: LegacyFileRow[] = [
    ...garmentRows.map((row) => ({
      id: row.id,
      uploadthing_key: row.uploadthing_key,
      table: "garments" as const,
    })),
    ...wearerRows.map((row) => ({
      id: row.id,
      uploadthing_key: row.uploadthing_key,
      table: "wearer_profile" as const,
    })),
  ];

  if (legacy.length === 0) return;

  const keys = legacy
    .map((row) => row.uploadthing_key?.trim() || "")
    .filter(Boolean);
  const sealed = await makeUploadThingFilesPrivate(keys, resolved.token);
  if (!sealed) {
    logServerError(
      "sealLegacyUploadThingMedia",
      `updateACL failed for ${keys.length} legacy file(s); media remains public.`,
    );
    return;
  }

  for (const row of legacy) {
    const fileKey = row.uploadthing_key?.trim();
    if (!fileKey) continue;
    const asset = await insertLegacyMediaAsset({
      userId,
      connectionId,
      kind: row.table === "wearer_profile" ? "wearer_photo" : "closet_image",
      fileKey,
    });
    if (!asset) continue;
    const displayUrl = mediaAssetDisplayPath(asset.id);
    if (row.table === "garments") {
      await sql`
        UPDATE garments
        SET
          media_asset_id = ${asset.id}::uuid,
          image_url = ${displayUrl},
          updated_at = now()
        WHERE id = ${row.id}::uuid
          AND user_id = ${userId}
          AND media_asset_id IS NULL
      `;
    } else {
      await sql`
        UPDATE wearer_profile
        SET
          media_asset_id = ${asset.id}::uuid,
          image_url = ${displayUrl},
          updated_at = now()
        WHERE user_id = ${userId}
          AND media_asset_id IS NULL
      `;
    }
  }
}
