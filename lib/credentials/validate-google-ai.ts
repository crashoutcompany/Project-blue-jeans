import "server-only";

import { normalizePastedSecret } from "@/lib/credentials/paste";

const MODELS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1";
const VALIDATE_TIMEOUT_MS = 10_000;

export type GoogleAiStudioValidation =
  | { ok: true; apiKey: string }
  | { ok: false; message: string };

/**
 * Confirms a Gemini Developer API key with a metadata read. Does not generate
 * content and never returns Google's error body to the client.
 */
export async function validateGoogleAiStudioApiKey(
  rawKey: string,
): Promise<GoogleAiStudioValidation> {
  const apiKey = normalizePastedSecret(rawKey);
  if (apiKey.length < 8 || apiKey.length > 512) {
    return {
      ok: false,
      message: "Enter a Google AI Studio API key.",
    };
  }

  try {
    const response = await fetch(MODELS_URL, {
      method: "GET",
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
      cache: "no-store",
    });

    if (response.ok) return { ok: true, apiKey };

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: "That Google AI Studio key could not be verified.",
      };
    }

    return {
      ok: false,
      message: "Google AI Studio is unavailable. Try again in a moment.",
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Google AI Studio. Try again.",
    };
  }
}
