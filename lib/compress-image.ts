import imageCompression from "browser-image-compression";

/** Long edge cap — enough for UI + vision models without phone-camera bloat */
export const COMPRESS_MAX_EDGE_PX = 1920;

/** JPEG/WebP quality (library-specific; ~0.82 is a good default for closet photos) */
export const COMPRESS_INITIAL_QUALITY = 0.82;

/** Skip compression for files already under this size (MB) */
export const COMPRESS_SKIP_BELOW_MB = 0.35;

/**
 * Resize + compress in the browser before UploadThing.
 * HEIC/unsupported types may throw — caller should catch and show a message.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB <= COMPRESS_SKIP_BELOW_MB) {
    return file;
  }

  const options: Parameters<typeof imageCompression>[1] = {
    maxWidthOrHeight: COMPRESS_MAX_EDGE_PX,
    useWebWorker: true,
    initialQuality: COMPRESS_INITIAL_QUALITY,
    maxSizeMB: Math.max(sizeMB, 4),
    fileType: "image/jpeg",
  };

  try {
    const out = await imageCompression(file, options);
    const base =
      file.name.replace(/\.[^/.]+$/, "") || "photo";
    return new File([out], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not process this image.";
    throw new Error(
      `${message} Try another format (JPEG/PNG/WebP) or a smaller photo.`
    );
  }
}
