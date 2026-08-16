import { UTApi } from "uploadthing/server";

import { logServerError } from "@/lib/server/safe-client-error";

/**
 * Best-effort delete of UploadThing files. Missing token or API errors are
 * logged; callers still persist the DB change so the closet stays consistent.
 */
export async function deleteUploadThingFiles(keys: string[]): Promise<void> {
  const fileKeys = keys.map((k) => k.trim()).filter(Boolean);
  if (fileKeys.length === 0) return;
  if (!process.env.UPLOADTHING_TOKEN?.trim()) {
    logServerError(
      "deleteUploadThingFiles",
      "UPLOADTHING_TOKEN is not set; skipped file delete.",
    );
    return;
  }

  try {
    const utapi = new UTApi();
    await utapi.deleteFiles(fileKeys);
  } catch (e) {
    logServerError("deleteUploadThingFiles", e);
  }
}
