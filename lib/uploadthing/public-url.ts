/** Prefer UploadThing v7 `ufsUrl`, then legacy `url` / `appUrl`. */
export function publicImageUrl(file: {
  ufsUrl?: string;
  url?: string;
  appUrl?: string;
}): string {
  return file.ufsUrl || file.url || file.appUrl || "";
}
