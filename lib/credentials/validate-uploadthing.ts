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

const PROBE_FILE_NAME = "blue-jeans-token-check.txt";

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), VALIDATE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * `ufsUrl` comes from UploadThing's ingest response, so it names the app that
 * actually stored the file: `https://{appId}.ufs.sh/f/{key}` or
 * `https://ufs.sh/a/{appId}/{key}`.
 */
export function ufsUrlBelongsToApp(ufsUrl: string, appId: string): boolean {
  let url: URL;
  try {
    url = new URL(ufsUrl);
  } catch {
    return false;
  }
  const expected = appId.toLowerCase();
  const subdomain = url.hostname.toLowerCase().split(".")[0];
  if (subdomain === expected) return true;
  return url.pathname.toLowerCase().startsWith(`/a/${expected}/`);
}

/**
 * Confirms an UploadThing token by uploading and deleting a tiny probe file.
 * The token's `appId` is plain base64 the user controls; only an upload proves
 * the API key belongs to that app, because ingest verifies the presigned URL
 * signature against the app named in it. A metadata read such as
 * `getUsageInfo` only checks the API key, which would let a Wearer bind
 * someone else's (public) app id. Never returns UploadThing's error body.
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

  const unverified = {
    ok: false as const,
    message: "That UploadThing token could not be verified.",
  };

  try {
    const { UTApi } = await import("uploadthing/server");
    const utapi = new UTApi({ token });
    const probe = new File(["blue-jeans token check"], PROBE_FILE_NAME, {
      type: "text/plain",
    });
    const uploaded = await withTimeout(utapi.uploadFiles(probe));
    if (uploaded.error || !uploaded.data) return unverified;

    await withTimeout(utapi.deleteFiles(uploaded.data.key)).catch(() => {
      // A leftover probe costs a few bytes; it must not fail validation.
    });

    if (!ufsUrlBelongsToApp(uploaded.data.ufsUrl, appId)) return unverified;
    return { ok: true, token, appId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "timeout") {
      return {
        ok: false,
        message: "Could not reach UploadThing. Try again.",
      };
    }
    return unverified;
  }
}
