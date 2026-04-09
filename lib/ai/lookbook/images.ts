export function firstImageDataUrl(
  files: { mediaType: string; uint8Array: Uint8Array }[],
): string | undefined {
  for (const file of files) {
    if (file.mediaType.startsWith("image/") && file.uint8Array.byteLength > 0) {
      const b64 = Buffer.from(file.uint8Array).toString("base64");
      return `data:${file.mediaType};base64,${b64}`;
    }
  }
  return undefined;
}
