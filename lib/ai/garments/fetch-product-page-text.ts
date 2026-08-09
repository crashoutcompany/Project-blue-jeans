const MAX_CHARS_PER_PAGE = 8_000;
/** Raw HTML/bytes cap before plain-text conversion (product pages can be large). */
const MAX_RAW_BYTES = 512_000;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Best-effort plain-text extract from a public product page for garment AI context.
 * Returns null on network/HTTP failures (caller falls back to photo-only).
 */
export async function fetchProductPageText(
  url: string,
  options?: { abortSignal?: AbortSignal },
): Promise<string | null> {
  try {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const signal = options?.abortSignal
      ? AbortSignal.any([timeout, options.abortSignal])
      : timeout;

    const res = await fetch(url, {
      redirect: "follow",
      signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "ProjectBlueJeansCloset/1.0 (+https://github.com; garment catalog)",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text/") &&
      !contentType.includes("html") &&
      !contentType.includes("xml") &&
      !contentType.includes("json")
    ) {
      return null;
    }

    const contentLength = Number(res.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_RAW_BYTES
    ) {
      return null;
    }

    const raw = await readBodyCapped(res, MAX_RAW_BYTES);
    if (raw === null) return null;

    const text = htmlToPlainText(raw).slice(0, MAX_CHARS_PER_PAGE).trim();
    return text.length > 40 ? text : null;
  } catch {
    return null;
  }
}

async function readBodyCapped(
  res: Response,
  maxBytes: number,
): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return text.length <= maxBytes ? text : null;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    return null;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
