import { createVertex } from "@ai-sdk/google-vertex";

/** GCP project ID from env; strips quotes and a mistaken leading `=` from .env paste errors. */
function vertexProjectId(): string | undefined {
  let p = process.env.GOOGLE_VERTEX_PROJECT?.trim();
  if (!p) return undefined;
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1).trim();
  }
  if (p.startsWith("=")) p = p.slice(1).trim();
  return p || undefined;
}

function parseServiceAccountJson(): Record<string, unknown> | undefined {
  const raw = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return undefined;
  try {
    const credentials = JSON.parse(raw) as Record<string, unknown>;
    if (!credentials || typeof credentials !== "object") return undefined;
    return credentials;
  } catch {
    return undefined;
  }
}

function parseServiceAccountAuth():
  | { credentials: Record<string, unknown> }
  | undefined {
  const credentials = parseServiceAccountJson();
  if (!credentials) return undefined;
  return { credentials };
}

/**
 * All Gemini calls in this app use **Vertex AI** (not the Gemini Developer API).
 * Required: `GOOGLE_VERTEX_PROJECT` plus one of the auth methods below.
 *
 * - Valid `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` (must parse as JSON object)
 * - `GOOGLE_APPLICATION_CREDENTIALS` path to a key file
 * - `GOOGLE_VERTEX_USE_ADC=1` — use Application Default Credentials (e.g. `gcloud auth application-default login`)
 * - Cloud Run / GCE: `K_SERVICE` set (workload identity / metadata)
 */
export function hasGeminiCredentials(): boolean {
  if (!vertexProjectId()) return false;
  if (parseServiceAccountJson()) return true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return true;
  if (process.env.GOOGLE_VERTEX_USE_ADC === "1") return true;
  if (process.env.K_SERVICE) return true;
  return false;
}

export type ModelId = Parameters<ReturnType<typeof createVertex>>[0];

function getVertexProvider() {
  const project = vertexProjectId();
  if (!project) {
    throw new Error("GOOGLE_VERTEX_PROJECT is not set.");
  }
  return createVertex({
    project,
    location: process.env.GOOGLE_VERTEX_LOCATION?.trim() || "us-central1",
    googleAuthOptions: parseServiceAccountAuth(),
  });
}

/** Chat / structured / multimodal models (Flash, Flash Image, etc.) via Vertex. */
export function geminiModel(modelId: string) {
  return getVertexProvider()(modelId);
}
