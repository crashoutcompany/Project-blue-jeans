import "server-only";

import type { MembershipPolicy } from "@/lib/auth/membership";
import { resolveUploadThingTokenForConnection } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";

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

export async function getUploadIntentById(intentId: string): Promise<{
  userId: string;
  connectionId: string | null;
} | null> {
  const id = intentId.trim();
  if (!id) return null;
  const sql = requireSql();
  const rows = (await sql`
    SELECT user_id, connection_id
    FROM upload_intents
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as Array<{ user_id: string; connection_id: string | null }>;
  const row = rows[0];
  if (!row) return null;
  return { userId: row.user_id, connectionId: row.connection_id };
}

export async function consumeUploadIntent(input: {
  intentId: string;
  userId: string;
  fileKey: string;
  kind: MediaKind;
}): Promise<{ mediaAssetId: string } | null> {
  const sql = requireSql();

  if (input.kind === "wearer_photo") {
    const rows = (await sql`
      WITH claimed AS (
        UPDATE upload_intents
        SET consumed_at = now()
        WHERE id = ${input.intentId}::uuid
          AND user_id = ${input.userId}
          AND endpoint = 'wearerPhoto'
          AND consumed_at IS NULL
          AND expires_at > now()
        RETURNING id, connection_id
      ),
      inserted AS (
        INSERT INTO media_assets (
          user_id,
          connection_id,
          kind,
          provider_file_key
        )
        SELECT
          ${input.userId},
          claimed.connection_id,
          'wearer_photo'::media_kind,
          ${input.fileKey}
        FROM claimed
        ON CONFLICT (user_id, provider_file_key)
        DO UPDATE SET
          connection_id = COALESCE(
            EXCLUDED.connection_id,
            media_assets.connection_id
          ),
          updated_at = now()
        RETURNING id
      )
      UPDATE upload_intents ui
      SET media_asset_id = inserted.id
      FROM claimed, inserted
      WHERE ui.id = claimed.id
      RETURNING inserted.id
    `) as Array<{ id: string }>;
    return rows[0] ? { mediaAssetId: rows[0].id } : null;
  }

  const intents = (await sql`
    SELECT id, connection_id, endpoint
    FROM upload_intents
    WHERE id = ${input.intentId}::uuid
      AND user_id = ${input.userId}
      AND expires_at > now()
      AND endpoint = 'closetImage'
    LIMIT 1
  `) as Array<{
    id: string;
    connection_id: string | null;
    endpoint: UploadEndpoint;
  }>;

  const intent = intents[0];
  if (!intent || intent.endpoint !== "closetImage") return null;

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

  await sql`
    UPDATE upload_intents
    SET media_asset_id = ${mediaAssetId}::uuid
    WHERE id = ${intent.id}::uuid
  `;

  return { mediaAssetId };
}

/**
 * Delete successful uploads that expired without being claimed by a garment
 * or wearer profile. Called from upload middleware so abandoned files do not
 * linger indefinitely.
 */
export async function cleanupExpiredUnclaimedUploads(
  membershipByUser = new Map<string, MembershipPolicy | null>(),
): Promise<void> {
  const sql = requireSql();
  const rows = (await sql`
    SELECT
      ma.id,
      ma.user_id,
      ma.connection_id,
      ma.provider_file_key
    FROM media_assets ma
    JOIN upload_intents ui
      ON ui.media_asset_id = ma.id
    WHERE ui.expires_at < now()
      AND NOT EXISTS (
        SELECT 1 FROM garments g WHERE g.media_asset_id = ma.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM wearer_profile p WHERE p.media_asset_id = ma.id
      )
    LIMIT 50
  `) as Array<{
    id: string;
    user_id: string;
    connection_id: string | null;
    provider_file_key: string;
  }>;

  for (const row of rows) {
    const membership = membershipByUser.get(row.user_id);
    const resolved = await resolveUploadThingTokenForConnection(
      row.user_id,
      row.connection_id,
      membership,
    );
    const deleted = await deleteUploadThingFiles(
      [row.provider_file_key],
      resolved.ok ? resolved.token : null,
    );
    if (!deleted) continue;
    await sql`
      DELETE FROM media_assets
      WHERE id = ${row.id}::uuid
        AND user_id = ${row.user_id}
    `;
  }
}
