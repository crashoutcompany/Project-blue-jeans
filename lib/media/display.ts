/** Same-origin display path for a private media asset. Not a durable CDN URL. */
export const MEDIA_ASSET_PATH_PREFIX = "/api/media/";

/** UploadThing signed URL lifetime for browser and server fetches. */
export const MEDIA_SIGNED_URL_MAX_SECONDS = 15 * 60;

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
 * Private media must not go through Next's publicly cacheable optimizer.
 */
export function shouldBypassImageOptimizer(src: string): boolean {
  return (
    src.startsWith(MEDIA_ASSET_PATH_PREFIX) ||
    src.startsWith("data:") ||
    src.includes("?")
  );
}
