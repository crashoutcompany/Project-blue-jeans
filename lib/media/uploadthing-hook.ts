import "server-only";

import { resolveUploadThingToken, resolveUploadThingTokenForConnection, uploadThingEnvToken } from "@/lib/credentials/resolve";
import { getUploadIntentById } from "@/lib/media/intents";

export function isUploadThingServerHook(request: Request): boolean {
  if (request.method !== "POST") return false;
  const hook = request.headers.get("uploadthing-hook");
  return hook === "callback" || hook === "error";
}

function metadataString(
  metadata: Record<string, unknown> | null,
  key: string,
): string {
  if (!metadata) return "";
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function hookMetadata(json: unknown): Record<string, unknown> | null {
  if (
    json &&
    typeof json === "object" &&
    "metadata" in json &&
    json.metadata &&
    typeof json.metadata === "object"
  ) {
    return json.metadata as Record<string, unknown>;
  }
  return null;
}

/**
 * UploadThing signs callbacks with the app token that issued the upload.
 * Read identity from signed metadata, then the intent row, then the platform
 * env token for legacy owner error hooks that omit metadata.userId.
 */
export async function resolveUploadThingHookToken(
  request: Request,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const hook = request.headers.get("uploadthing-hook");
  let json: unknown;
  try {
    json = await request.clone().json();
  } catch {
    return { ok: false, message: "Invalid UploadThing callback." };
  }

  const metadata = hookMetadata(json);
  const userId = metadataString(metadata, "userId");
  const intentId = metadataString(metadata, "intentId");
  const connectionId = metadataString(metadata, "connectionId");

  if (userId) {
    const resolved = connectionId
      ? await resolveUploadThingTokenForConnection(userId, connectionId)
      : await resolveUploadThingToken(userId);
    if (!resolved.ok) {
      return { ok: false, message: resolved.message };
    }
    return { ok: true, token: resolved.token };
  }

  if (intentId) {
    try {
      const intent = await getUploadIntentById(intentId);
      if (intent) {
        const resolved = await resolveUploadThingTokenForConnection(
          intent.userId,
          intent.connectionId,
        );
        if (resolved.ok) {
          return { ok: true, token: resolved.token };
        }
      }
    } catch {
      // Fall through to the platform token for error hooks.
    }
  }

  if (hook === "error") {
    const platformToken = uploadThingEnvToken();
    if (platformToken) {
      return { ok: true, token: platformToken };
    }
  }

  return { ok: false, message: "UploadThing callback is missing a Wearer." };
}
