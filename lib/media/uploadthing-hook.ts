import "server-only";

import { resolveUploadThingToken } from "@/lib/credentials/resolve";

export function isUploadThingServerHook(request: Request): boolean {
  if (request.method !== "POST") return false;
  const hook = request.headers.get("uploadthing-hook");
  return hook === "callback" || hook === "error";
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * UploadThing signs callbacks with the app token that issued the upload.
 * Read userId from the signed payload's metadata after cloning the body so
 * createRouteHandler can still verify the signature.
 */
export async function resolveUploadThingHookToken(
  request: Request,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  let json: unknown;
  try {
    json = await request.clone().json();
  } catch {
    return { ok: false, message: "Invalid UploadThing callback." };
  }

  const metadata =
    json &&
    typeof json === "object" &&
    "metadata" in json &&
    json.metadata &&
    typeof json.metadata === "object"
      ? (json.metadata as Record<string, unknown>)
      : null;
  const userId = metadata ? metadataString(metadata, "userId") : "";
  if (!userId) {
    return { ok: false, message: "UploadThing callback is missing a Wearer." };
  }

  const resolved = await resolveUploadThingToken(userId);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }
  return { ok: true, token: resolved.token };
}
