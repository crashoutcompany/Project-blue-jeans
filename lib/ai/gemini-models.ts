import { ModelId } from "./gemini-provider";

/** Structured JSON / copy for the lookbook (step 1). */
// Gemini 3 Models not yet supported in Vertex AI
export const GEMINI_STRUCTURE_MODEL: ModelId = "gemini-2.5-flash";

/** Interactive hero image (step 2) — Nano Banana family. */
export const GEMINI_IMAGE_MODEL: ModelId = "gemini-2.5-flash-image";
