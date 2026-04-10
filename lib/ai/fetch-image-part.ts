/**
 * Fetch a remote image for multimodal model input (Gemini via AI SDK).
 */
export async function fetchUrlAsImagePart(url: string): Promise<{
  type: "image";
  image: Uint8Array;
  mediaType?: string;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status})`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mediaType = ct?.startsWith("image/") ? ct : "image/jpeg";
  return { type: "image", image: buf, mediaType };
}
