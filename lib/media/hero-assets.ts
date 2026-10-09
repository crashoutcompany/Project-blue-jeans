import "server-only";

import { randomUUID } from "node:crypto";

import { UTFile } from "uploadthing/server";

import type { GeneratedImage } from "@/lib/ai/lookbook/images";
import { requireSql } from "@/lib/db";
import { mediaAssetDisplayPath } from "@/lib/media/display";
import {
  resolveUploadSession,
  type ResolvedUploadSession,
} from "@/lib/media/resolve-upload-session";
import { createUploadThingApi } from "@/lib/media/uploadthing-api";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";
import { logServerError } from "@/lib/server/safe-client-error";

function heroFileName(mediaType: string): string {
  const ext = mediaType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  return `outfit-hero-${randomUUID()}.${ext}`;
}

/**
 * Persist generated hero images as owned `outfit_hero` media assets so rows
 * and payloads carry a short `/api/media/<id>` path instead of a multi-MB
 * base64 data URL. The upload session is resolved once per store.
 *
 * Returns `null` when storage fails — a hero is optional for every look.
 */
export function createHeroImageStore(userId: string) {
  let session: Promise<ResolvedUploadSession> | null = null;

  return async function storeHeroImage(
    image: GeneratedImage,
  ): Promise<string | null> {
    session ??= resolveUploadSession(userId);
    const resolved = await session;
    if (!resolved.ok) {
      logServerError("storeHeroImage", resolved.message);
      return null;
    }

    let fileKey: string | null = null;
    try {
      const file = new UTFile(
        [Buffer.from(image.bytes)],
        heroFileName(image.mediaType),
        { type: image.mediaType },
      );
      const uploaded = await createUploadThingApi(resolved.token).uploadFiles(
        file,
      );
      if (uploaded.error || !uploaded.data) {
        throw new Error(uploaded.error?.message ?? "Hero upload failed.");
      }
      fileKey = uploaded.data.key;

      const sql = requireSql();
      const rows = (await sql`
        INSERT INTO media_assets (
          user_id,
          connection_id,
          kind,
          provider_file_key
        )
        VALUES (
          ${userId},
          ${resolved.connectionId}::uuid,
          'outfit_hero'::media_kind,
          ${fileKey}
        )
        RETURNING id
      `) as Array<{ id: string }>;
      const id = rows[0]?.id;
      if (!id) throw new Error("Hero media insert returned no id.");
      return mediaAssetDisplayPath(id);
    } catch (e) {
      logServerError("storeHeroImage", e);
      if (fileKey) {
        await deleteUploadThingFiles([fileKey], resolved.token);
      }
      return null;
    }
  };
}
