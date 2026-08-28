/** Gemini rejects inputs well below this; the cap is a memory guard, not a limit. */
export const MAX_AI_IMAGE_BYTES = 12 * 1024 * 1024;

/** A stalled provider must not hold a request open for the whole route budget. */
export const AI_IMAGE_FETCH_TIMEOUT_MS = 20_000;

export class ImageTooLargeError extends Error {
  constructor(readonly bytes: number | null) {
    super(
      bytes === null
        ? "That image is too large to send to the model."
        : `That image is ${bytes} bytes, over the ${MAX_AI_IMAGE_BYTES} byte limit.`,
    );
    this.name = "ImageTooLargeError";
  }
}

/**
 * Read at most `MAX_AI_IMAGE_BYTES`, aborting as soon as the cap is passed.
 * `arrayBuffer()` would buffer the whole body first, so a hostile or simply
 * huge object could exhaust memory — and the weekly job fetches these for
 * several looks at once.
 */
async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AI_IMAGE_BYTES) {
    throw new ImageTooLargeError(declared);
  }

  const body = res.body;
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_AI_IMAGE_BYTES) {
        throw new ImageTooLargeError(null);
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Fetch a remote image for multimodal model input (Gemini via AI SDK).
 */
export async function fetchUrlAsImagePart(
  url: string,
  options?: { abortSignal?: AbortSignal; timeoutMs?: number },
): Promise<{
  type: "image";
  image: Uint8Array;
  mediaType?: string;
}> {
  const timeoutMs = options?.timeoutMs ?? AI_IMAGE_FETCH_TIMEOUT_MS;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (options?.abortSignal) signals.push(options.abortSignal);

  const res = await fetch(url, { signal: AbortSignal.any(signals) });
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status})`);
  }
  const buf = await readCapped(res);
  const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mediaType = ct?.startsWith("image/") ? ct : "image/jpeg";
  return { type: "image", image: buf, mediaType };
}
