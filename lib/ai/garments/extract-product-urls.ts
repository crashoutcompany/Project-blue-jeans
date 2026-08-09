/** Max URLs Vertex url_context accepts per request. */
export const MAX_PRODUCT_URLS = 20;

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

/**
 * Pull http(s) links from free text (e.g. garment notes).
 * Strips common trailing punctuation; de-duplicates; caps at {@link MAX_PRODUCT_URLS}.
 */
export function extractProductUrls(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];

  const found = text.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of found) {
    const cleaned = raw.replace(/[),.;:!?\]]+$/g, "");
    if (!cleaned) continue;
    try {
      const u = new URL(cleaned);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (seen.has(u.href)) continue;
      seen.add(u.href);
      out.push(u.href);
      if (out.length >= MAX_PRODUCT_URLS) break;
    } catch {
      // skip invalid
    }
  }

  return out;
}
