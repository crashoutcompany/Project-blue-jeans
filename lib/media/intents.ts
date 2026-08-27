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

/** Grace period before an unattached upload is treated as abandoned. */
const CLEANUP_GRACE_SECONDS = INTENT_TTL_MS / 1000;

/** Delete at most this many abandoned files per upload, to bound the sweep. */
const CLEANUP_BATCH = 50;

/**
 * Delete successful uploads that were never attached to a garment or wearer
 * profile. Called from upload middleware so abandoned files do not linger.
 *
 * Assets are matched on their own age rather than through
 * `upload_intents.media_asset_id`: that column holds a single id, so a closet
 * intent covering several files only ever pointed at the last one and the rest
 * were unreachable forever. `provider_file_key` is checked alongside the asset
 * id so a legacy row that still references the file by key is never swept.
 */
export async function cleanupExpiredUnclaimedUploads(input: {
  userId: string;
  membership?: MembershipPolicy | null;
}): Promise<void> {
  const sql = requireSql();
  const rows = (await sql`
    SELECT
      ma.id,
      ma.connection_id,
      ma.provider_file_key
    FROM media_assets ma
    WHERE ma.user_id = ${input.userId}
      AND ma.created_at
          < now() - make_interval(secs => ${CLEANUP_GRACE_SECONDS}::double precision)
      AND NOT EXISTS (
        SELECT 1 FROM garments g
        WHERE g.user_id = ma.user_id
          AND (
            g.media_asset_id = ma.id
            OR g.uploadthing_key = ma.provider_file_key
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM wearer_profile p
        WHERE p.user_id = ma.user_id
          AND (
            p.media_asset_id = ma.id
            OR p.uploadthing_key = ma.provider_file_key
          )
      )
    ORDER BY ma.created_at
    LIMIT ${CLEANUP_BATCH}
  `) as Array<{
    id: string;
    connection_id: string | null;
    provider_file_key: string;
  }>;

  if (rows.length === 0) return;

  // Group by connection so each provider token is resolved once, not per file.
  const byConnection = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const existing = byConnection.get(row.connection_id);
    if (existing) existing.push(row);
    else byConnection.set(row.connection_id, [row]);
  }

  for (const [connectionId, group] of byConnection) {
    const resolved = await resolveUploadThingTokenForConnection(
      input.userId,
      connectionId,
      input.membership,
    );
    if (!resolved.ok) continue;
    const deleted = await deleteUploadThingFiles(
      group.map((row) => row.provider_file_key),
      resolved.token,
    );
    if (!deleted) continue;
    await sql`
      DELETE FROM media_assets
      WHERE user_id = ${input.userId}
        AND id = ANY(${group.map((row) => row.id)}::uuid[])
    `;
  }
}
