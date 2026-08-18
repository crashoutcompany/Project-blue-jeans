import { createGoogleGenerativeAI, google } from "@ai-sdk/google";

/**
 * All Gemini calls in this app use the **Gemini Developer API** (Google AI Studio),
 * not Vertex AI. Callers must pass a key already resolved for the Wearer
 * (`resolveGeminiApiKey`) — this helper never reads the platform env itself.
 */
export type ModelId = Parameters<typeof google>[0];

/** Chat / structured / multimodal models (Flash, Flash Image, etc.) via AI Studio. */
export function geminiModel(modelId: string, apiKey: string) {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Gemini API key is missing.");
  }
  return createGoogleGenerativeAI({ apiKey: key })(modelId);
}

/** Built-in Gemini tools (e.g. `urlContext`) from the Google AI SDK provider. */
export { google as googleAi };
