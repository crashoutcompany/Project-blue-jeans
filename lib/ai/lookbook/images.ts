export type GeneratedImage = {
  mediaType: string;
  bytes: Uint8Array;
};

export function firstImageFile(
  files: { mediaType: string; uint8Array: Uint8Array }[],
): GeneratedImage | undefined {
  for (const file of files) {
    if (file.mediaType.startsWith("image/") && file.uint8Array.byteLength > 0) {
      return { mediaType: file.mediaType, bytes: file.uint8Array };
    }
  }
  return undefined;
}
