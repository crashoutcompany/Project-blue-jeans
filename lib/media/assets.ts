import "server-only";

import { requireSql } from "@/lib/db";
import { mediaAssetDisplayPath } from "@/lib/media/display";

export type MediaKind = "closet_image" | "wearer_photo";

export type OwnedMediaAsset = {
  id: string;
  userId: string;
  connectionId: string | null;
  kind: MediaKind;
  providerFileKey: string;
};

type MediaAssetRow = {
  id: string;
  user_id: string;
  connection_id: string | null;
  kind: MediaKind;
  provider_file_key: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeMediaAssetId(id: string): string | null {
  const normalized = id.trim().toLowerCase();
  if (!UUID_RE.test(normalized)) return null;
  return normalized;
}

function mapRow(row: MediaAssetRow): OwnedMediaAsset {
  return {
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    kind: row.kind,
    providerFileKey: row.provider_file_key,
  };
}

export async function getOwnedMediaAsset(
  userId: string,
  mediaAssetId: string,
): Promise<OwnedMediaAsset | null> {
  const id = normalizeMediaAssetId(mediaAssetId);
  if (!id) return null;
  const sql = requireSql();
  const rows = (await sql`
    SELECT id, user_id, connection_id, kind::text AS kind, provider_file_key
    FROM media_assets
    WHERE id = ${id}::uuid
      AND user_id = ${userId}
    LIMIT 1
  `) as MediaAssetRow[];
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function claimOwnedMediaAssets(input: {
  userId: string;
  mediaAssetIds: string[];
  kind: MediaKind;
}): Promise<
  | { ok: true; assets: OwnedMediaAsset[] }
  | { ok: false; message: string }
> {
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.mediaAssetIds) {
    const id = normalizeMediaAssetId(raw);
    if (!id) {
      return { ok: false, message: "Each item needs a media id." };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueIds.push(id);
  }
  if (uniqueIds.length === 0) {
    return { ok: false, message: "Each item needs a media id." };
  }

  const sql = requireSql();
  const rows = (await sql`
    SELECT id, user_id, connection_id, kind::text AS kind, provider_file_key
    FROM media_assets
    WHERE user_id = ${input.userId}
      AND kind = ${input.kind}::media_kind
      AND id = ANY(${uniqueIds}::uuid[])
  `) as MediaAssetRow[];

  if (rows.length !== uniqueIds.length) {
    return {
      ok: false,
      message: "One or more uploads could not be found for this account.",
    };
  }

  const used = (await sql`
    SELECT media_asset_id
    FROM garments
    WHERE user_id = ${input.userId}
      AND media_asset_id = ANY(${uniqueIds}::uuid[])
  `) as Array<{ media_asset_id: string }>;
  if (used.length > 0) {
    return {
      ok: false,
      message: "That upload is already in your closet.",
    };
  }

  const byId = new Map(
    rows.map((row) => [row.id.toLowerCase(), mapRow(row)]),
  );
  const assets = uniqueIds.map((id) => byId.get(id)!);
  return { ok: true, assets };
}

export async function insertLegacyMediaAsset(input: {
  userId: string;
  connectionId: string | null;
  kind: MediaKind;
  fileKey: string;
}): Promise<OwnedMediaAsset | null> {
  const sql = requireSql();
  const rows = (await sql`
    INSERT INTO media_assets (
      user_id,
      connection_id,
      kind,
      provider_file_key
    )
    VALUES (
      ${input.userId},
      ${input.connectionId}::uuid,
      ${input.kind}::media_kind,
      ${input.fileKey}
    )
    ON CONFLICT (user_id, provider_file_key)
    DO UPDATE SET
      connection_id = COALESCE(
        EXCLUDED.connection_id,
        media_assets.connection_id
      ),
      updated_at = now()
    RETURNING id, user_id, connection_id, kind::text AS kind, provider_file_key
  `) as MediaAssetRow[];
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export function displayUrlForAsset(asset: OwnedMediaAsset): string {
  return mediaAssetDisplayPath(asset.id);
}
