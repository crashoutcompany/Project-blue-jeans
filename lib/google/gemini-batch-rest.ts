/**
 * Gemini Developer API — batch image generation via REST.
 * @see https://ai.google.dev/gemini-api/docs/batch-api
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type BatchInlinedRequest = {
  request: Record<string, unknown>;
};

export async function batchGenerateContentCreate(
  apiKey: string,
  modelId: string,
  displayName: string,
  inlinedRequests: BatchInlinedRequest[],
): Promise<{ name?: string }> {
  const url = `${BASE}/models/${encodeURIComponent(modelId)}:batchGenerateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      batch: {
        displayName,
        inputConfig: {
          requests: { requests: inlinedRequests },
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`batchGenerateContent failed: ${res.status} ${text.slice(0, 500)}`);
  }
  const json = JSON.parse(text) as { name?: string };
  return json;
}

export async function getOperation(
  apiKey: string,
  operationName: string,
): Promise<Record<string, unknown>> {
  const url = `${BASE}/${operationName}`;
  const res = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`operations.get failed: ${res.status} ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

type InlinePart = {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

function partInlineData(p: InlinePart): { mime: string; data: string } | null {
  const a = p.inlineData;
  if (a?.data && a.mimeType) return { mime: a.mimeType, data: a.data };
  const b = p.inline_data;
  if (b?.data && b.mime_type) return { mime: b.mime_type, data: b.data };
  return null;
}

function extractImageDataUrlFromGenerateContentResponse(
  resp: unknown,
): string | null {
  const r = resp as {
    candidates?: { content?: { parts?: InlinePart[] } }[];
  };
  const parts = r.candidates?.[0]?.content?.parts;
  if (!parts) return null;
  for (const p of parts) {
    const d = partInlineData(p);
    if (d) return `data:${d.mime};base64,${d.data}`;
  }
  return null;
}

function digInlinedResponseList(response: unknown): unknown[] | undefined {
  if (!response || typeof response !== "object") return undefined;
  const r = response as Record<string, unknown>;
  const inner = (r.output ?? r) as Record<string, unknown>;
  const ir = inner.inlinedResponses as Record<string, unknown> | undefined;
  if (ir && Array.isArray(ir.inlinedResponses)) {
    return ir.inlinedResponses as unknown[];
  }
  return undefined;
}

/** Parse batch operation `response` once `done` is true. */
export function extractInlinedImageDataUrls(operation: Record<string, unknown>): (
  | string
  | null
)[] {
  const response = operation.response as unknown;
  const list = digInlinedResponseList(response);
  if (!Array.isArray(list) || list.length === 0) return [];

  const urls: (string | null)[] = [];
  for (const item of list) {
    const row = item as {
      response?: unknown;
      error?: unknown;
    };
    if (row.error) {
      urls.push(null);
      continue;
    }
    urls.push(extractImageDataUrlFromGenerateContentResponse(row.response));
  }
  return urls;
}
