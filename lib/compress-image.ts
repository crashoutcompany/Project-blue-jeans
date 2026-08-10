import imageCompression from "browser-image-compression";

/** Long edge cap — enough for UI + vision models without phone-camera bloat */
export const COMPRESS_MAX_EDGE_PX = 1920;

/** JPEG/WebP quality (library-specific; ~0.82 is a good default for closet photos) */
export const COMPRESS_INITIAL_QUALITY = 0.82;

/** Skip compression for files already under this size (MB) */
export const COMPRESS_SKIP_BELOW_MB = 0.35;

/**
 * Prefer formats that keep an alpha channel when the source has one.
 * JPEG always flattens transparency to an opaque (usually white) background.
 */
export function outputMimeTypeForUpload(file: File): string {
  const type = file.type.toLowerCase().trim();
  if (type === "image/png" || type === "image/webp") return type;

  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";

  return "image/jpeg";
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Resize + compress in the browser before UploadThing.
 * PNG/WebP keep transparency; JPEG/others become JPEG.
 * HEIC/unsupported types may throw — caller should catch and show a message.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB <= COMPRESS_SKIP_BELOW_MB) {
    return file;
  }

  const fileType = outputMimeTypeForUpload(file);
  const options: Parameters<typeof imageCompression>[1] = {
    maxWidthOrHeight: COMPRESS_MAX_EDGE_PX,
    useWebWorker: true,
    initialQuality: COMPRESS_INITIAL_QUALITY,
    maxSizeMB: Math.max(sizeMB, 4),
    fileType,
  };

  try {
    const out = await imageCompression(file, options);
    const base = file.name.replace(/\.[^/.]+$/, "") || "photo";
    const ext = extensionForMime(fileType);
    return new File([out], `${base}.${ext}`, {
      type: fileType,
      lastModified: Date.now(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not process this image.";
    throw new Error(
      `${message} Try another format (JPEG/PNG/WebP) or a smaller photo.`,
    );
  }
}
