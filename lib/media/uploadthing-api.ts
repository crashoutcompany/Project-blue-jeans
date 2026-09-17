import "server-only";

import { UTApi } from "uploadthing/server";

import { decodeUploadThingAppId } from "@/lib/credentials/validate-uploadthing";
import { logServerError } from "@/lib/server/safe-client-error";
import { publicFileUrl } from "@/lib/uploadthing/public-url";

export function createUploadThingApi(token: string): UTApi {
  return new UTApi({ token });
}

export function publicUploadThingFileUrl(token: string, fileKey: string): string {
  const appId = decodeUploadThingAppId(token);
  if (!appId) {
    throw new Error("UploadThing token is missing an app id.");
  }
  return publicFileUrl(appId, fileKey);
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
