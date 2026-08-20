import { UTApi } from "uploadthing/server";

import { logServerError } from "@/lib/server/safe-client-error";

/**
 * Best-effort delete of UploadThing files. Missing token or API errors are
 * logged; callers still persist the DB change so the closet stays consistent.
 */
export async function deleteUploadThingFiles(
  keys: string[],
  token: string | null | undefined,
): Promise<boolean> {
  const fileKeys = keys.map((k) => k.trim()).filter(Boolean);
  if (fileKeys.length === 0) return true;
  if (!token?.trim()) {
    logServerError(
      "deleteUploadThingFiles",
      "UploadThing token is not set; skipped file delete.",
    );
    return false;
  }

  try {
    const utapi = new UTApi({ token: token.trim() });
    await utapi.deleteFiles(fileKeys);
    return true;
  } catch (e) {
    logServerError("deleteUploadThingFiles", e);
    return false;
  }
}
