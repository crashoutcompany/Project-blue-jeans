const APP_ID_RE = /^[a-z0-9_-]+$/i;
/** UploadThing keys are opaque; older ones include the original filename (`…_image.jpg`). */
const FILE_KEY_RE = /^[A-Za-z0-9._-]+$/;

/** Prefer UploadThing v7 `ufsUrl`, then legacy `url` / `appUrl`. */
export function publicImageUrl(file: {
  ufsUrl?: string;
  url?: string;
  appUrl?: string;
}): string {
  return file.ufsUrl || file.url || file.appUrl || "";
}

/** Durable public CDN URL for an UploadThing app file. */
export function publicFileUrl(appId: string, fileKey: string): string {
  const id = appId.trim();
  const key = fileKey.trim();
  if (!APP_ID_RE.test(id) || !FILE_KEY_RE.test(key)) {
    throw new Error("Invalid UploadThing file.");
  }
  return `https://${id}.ufs.sh/f/${key}`;
}
