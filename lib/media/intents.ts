import "server-only";

import { requireSql } from "@/lib/db";

export type UploadEndpoint = "closetImage" | "wearerPhoto";

const INTENT_TTL_MS = 30 * 60 * 1000;

export async function createUploadIntent(input: {
  userId: string;
  connectionId: string | null;
  endpoint: UploadEndpoint;
}): Promise<{ intentId: string }> {
  const sql = requireSql();
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();
  const rows = (await sql`
    INSERT INTO upload_intents (
      user_id,
      connection_id,
      endpoint,
      expires_at
    )
    VALUES (
      ${input.userId},
      ${input.connectionId}::uuid,
      ${input.endpoint},
      ${expiresAt}::timestamptz
    )
    RETURNING id
  `) as Array<{ id: string }>;

  const intentId = rows[0]?.id;
  if (!intentId) {
    throw new Error("Could not create an upload intent.");
  }
  return { intentId };
}

export type MediaKind = "closet_image" | "wearer_photo";

export async function consumeUploadIntent(input: {
  intentId: string;
  userId: string;
  fileKey: string;
  kind: MediaKind;
}): Promise<{ mediaAssetId: string } | null> {
  const sql = requireSql();
  const intents = (await sql`
    SELECT id, connection_id, endpoint
    FROM upload_intents
    WHERE id = ${input.intentId}::uuid
      AND user_id = ${input.userId}
      AND expires_at > now()
      AND (
        endpoint = 'closetImage'
        OR consumed_at IS NULL
      )
    LIMIT 1
  `) as Array<{
    id: string;
    connection_id: string | null;
    endpoint: UploadEndpoint;
  }>;

  const intent = intents[0];
  if (!intent) return null;
  if (
    (intent.endpoint === "closetImage") !==
    (input.kind === "closet_image")
  ) {
    return null;
  }

  const assets = (await sql`
    INSERT INTO media_assets (
      user_id,
      connection_id,
      kind,
      provider_file_key
    )
    VALUES (
      ${input.userId},
      ${intent.connection_id}::uuid,
      ${input.kind}::media_kind,
      ${input.fileKey}
    )
    ON CONFLICT (user_id, provider_file_key)
    DO UPDATE SET updated_at = now()
    RETURNING id
  `) as Array<{ id: string }>;

  const mediaAssetId = assets[0]?.id;
  if (!mediaAssetId) return null;

  if (intent.endpoint === "closetImage") {
    await sql`
      UPDATE upload_intents
      SET media_asset_id = ${mediaAssetId}::uuid
      WHERE id = ${intent.id}::uuid
    `;
  } else {
    await sql`
      UPDATE upload_intents
      SET
        consumed_at = now(),
        media_asset_id = ${mediaAssetId}::uuid
      WHERE id = ${intent.id}::uuid
        AND consumed_at IS NULL
    `;
  }

  return { mediaAssetId };
}
