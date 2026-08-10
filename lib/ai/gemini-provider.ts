import { createGoogleGenerativeAI, google } from "@ai-sdk/google";

/** AI Studio / Gemini Developer API key; strips quotes and a mistaken leading `=` from .env paste errors. */
function generativeAiApiKey(): string | undefined {
  let key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return undefined;
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.startsWith("=")) key = key.slice(1).trim();
  return key || undefined;
}

/**
 * All Gemini calls in this app use the **Gemini Developer API** (Google AI Studio),
 * not Vertex AI.
 *
 * Required: `GOOGLE_GENERATIVE_AI_API_KEY` from https://aistudio.google.com/apikey
 */
export function hasGeminiCredentials(): boolean {
  return Boolean(generativeAiApiKey());
}

export type ModelId = Parameters<typeof google>[0];

/** Chat / structured / multimodal models (Flash, Flash Image, etc.) via AI Studio. */
export function geminiModel(modelId: string) {
  const apiKey = generativeAiApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

/** Built-in Gemini tools (e.g. `urlContext`) from the Google AI SDK provider. */
export { google as googleAi };
