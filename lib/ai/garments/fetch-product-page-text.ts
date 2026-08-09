const MAX_CHARS_PER_PAGE = 8_000;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Best-effort plain-text extract from a public product page for garment AI context.
 * Returns null on network/HTTP failures (caller falls back to photo-only).
 */
export async function fetchProductPageText(
  url: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
    const raw = await res.text();
    const text = htmlToPlainText(raw).slice(0, MAX_CHARS_PER_PAGE).trim();
    return text.length > 40 ? text : null;
  } catch {
    return null;
  }
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
