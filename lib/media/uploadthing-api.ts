import "server-only";

import { UTApi } from "uploadthing/server";

import { MEDIA_SIGNED_URL_MAX_SECONDS } from "@/lib/media/display";
import { logServerError } from "@/lib/server/safe-client-error";

export function createUploadThingApi(token: string): UTApi {
  return new UTApi({ token });
}

export async function generatePrivateMediaUrl(
  token: string,
  fileKey: string,
  expiresInSeconds = MEDIA_SIGNED_URL_MAX_SECONDS,
): Promise<string> {
  const utapi = createUploadThingApi(token);
  const { ufsUrl } = await utapi.generateSignedURL(fileKey, {
    expiresIn: expiresInSeconds,
  });
  return ufsUrl;
}

export async function deleteUploadThingFiles(
  keys: string[],
  token: string | null | undefined,
): Promise<void> {
  const fileKeys = keys.map((k) => k.trim()).filter(Boolean);
  if (fileKeys.length === 0) return;
  if (!token?.trim()) {
    logServerError(
      "deleteUploadThingFiles",
      "UploadThing token is not set; skipped file delete.",
    );
    return;
  }

  try {
    const utapi = createUploadThingApi(token);
    await utapi.deleteFiles(fileKeys);
  } catch (e) {
    logServerError("deleteUploadThingFiles", e);
  }
}

export async function makeUploadThingFilesPrivate(
  keys: string[],
  token: string,
): Promise<boolean> {
  const fileKeys = keys.map((k) => k.trim()).filter(Boolean);
  if (fileKeys.length === 0) return true;
  try {
    const utapi = createUploadThingApi(token);
    await utapi.updateACL(fileKeys, "private");
    return true;
  } catch (e) {
    logServerError("makeUploadThingFilesPrivate", e);
    return false;
  }
}
