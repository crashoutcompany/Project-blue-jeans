import "server-only";

import { normalizePastedSecret } from "@/lib/credentials/paste";

const VALIDATE_TIMEOUT_MS = 10_000;

export type UploadThingValidation =
  | { ok: true; token: string; appId: string }
  | { ok: false; message: string };

/**
 * UploadThing tokens are base64 JSON (apiKey, appId, regions). Some dashboards
 * also mint JWTs; we read `appId` from either shape and never return the key.
 */
export function decodeUploadThingAppId(rawToken: string): string | null {
  const token = normalizePastedSecret(rawToken);
  if (!token) return null;

  const candidates = [token];
  const parts = token.split(".");
  if (parts.length === 3 && parts[1]) candidates.push(parts[1]);

  for (const part of candidates) {
    const appId = appIdFromBase64Json(part);
    if (appId) return appId;
  }
  return null;
}

function appIdFromBase64Json(part: string): string | null {
  for (const encoding of ["base64url", "base64"] as const) {
    try {
      const json = Buffer.from(part, encoding).toString("utf8");
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== "object") continue;
      const appId = (parsed as { appId?: unknown }).appId;
      if (typeof appId === "string" && appId.trim()) return appId.trim();
    } catch {
      // Try the next encoding / candidate.
    }
  }
  return null;
}

/**
 * Confirms an UploadThing API token with a usage metadata read. Does not list
 * files and never returns UploadThing's error body to the client.
 */
export async function validateUploadThingToken(
  rawToken: string,
): Promise<UploadThingValidation> {
  const token = normalizePastedSecret(rawToken);
  if (token.length < 8 || token.length > 4096) {
    return { ok: false, message: "Enter an UploadThing API token." };
  }

  const appId = decodeUploadThingAppId(token);
  if (!appId) {
    return {
      ok: false,
      message: "That UploadThing token could not be read. Paste the API token from the UploadThing dashboard.",
    };
  }

  try {
    const { UTApi } = await import("uploadthing/server");
    const utapi = new UTApi({ token });
    await Promise.race([
      utapi.getUsageInfo(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("timeout")),
          VALIDATE_TIMEOUT_MS,
        );
      }),
    ]);
    return { ok: true, token, appId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "timeout") {
      return {
        ok: false,
        message: "Could not reach UploadThing. Try again.",
      };
    }
    return {
      ok: false,
      message: "That UploadThing token could not be verified.",
    };
  }
}
