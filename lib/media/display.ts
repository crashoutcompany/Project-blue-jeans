/** Same-origin display path for an owned media asset. */
export const MEDIA_ASSET_PATH_PREFIX = "/api/media/";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mediaAssetDisplayPath(mediaAssetId: string): string {
  return `${MEDIA_ASSET_PATH_PREFIX}${mediaAssetId}`;
}

export function parseMediaAssetIdFromPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith(MEDIA_ASSET_PATH_PREFIX)) return null;
  const id = trimmed.slice(MEDIA_ASSET_PATH_PREFIX.length).split(/[/?#]/)[0];
  if (!id || !UUID_RE.test(id)) return null;
  return id;
}

/**
 * Cookie-gated /api/media paths must not go through Next's publicly cacheable
 * optimizer (it fetches without the caller's cookies).
 */
export function shouldBypassImageOptimizer(src: string): boolean {
  return (
    src.startsWith(MEDIA_ASSET_PATH_PREFIX) ||
    src.startsWith("data:") ||
    src.includes("?")
  );
}
