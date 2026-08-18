import "server-only";

import { fetchUrlAsImagePart } from "@/lib/ai/fetch-image-part";
import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { getOwnedMediaAsset } from "@/lib/media/assets";
import {
  parseMediaAssetIdFromPath,
} from "@/lib/media/display";
import { generatePrivateMediaUrl } from "@/lib/media/uploadthing-api";

export type OwnedImageRef = {
  mediaAssetId?: string | null;
  imageUrl?: string | null;
};

/**
 * Fetch bytes for an owned garment/photo. Resolves from a media record (or
 * its display path). Legacy public HTTPS URLs stored on an owned row are
 * fetched only as a transition; callers must never pass a client-supplied URL.
 */
export async function fetchOwnedImagePart(
  userId: string,
  ref: OwnedImageRef,
  options?: { abortSignal?: AbortSignal },
): Promise<{
  type: "image";
  image: Uint8Array;
  mediaType?: string;
}> {
  const url = await resolveOwnedImageFetchUrl(userId, ref);
  if (!url) {
    throw new Error("Could not load that photo.");
  }
  return fetchUrlAsImagePart(url, options);
}

export async function resolveOwnedImageFetchUrl(
  userId: string,
  ref: OwnedImageRef,
): Promise<string | null> {
  const mediaAssetId =
    ref.mediaAssetId?.trim() ||
    parseMediaAssetIdFromPath(ref.imageUrl ?? "") ||
    null;

  if (mediaAssetId) {
    const asset = await getOwnedMediaAsset(userId, mediaAssetId);
    if (!asset) return null;
    const resolved = await resolveUploadThingToken(userId);
    if (!resolved.ok) return null;
    return generatePrivateMediaUrl(resolved.token, asset.providerFileKey);
  }

  const imageUrl = ref.imageUrl?.trim() ?? "";
  if (imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  return null;
}

export async function resolveGarmentImageSourcesForAi(
  userId: string,
  rows: Array<{
    id: string;
    category: string;
    name: string | null;
    image_url: string;
    media_asset_id: string | null;
  }>,
): Promise<
  Array<{
    id: string;
    category: string;
    name: string | null;
    imageUrl: string;
  }>
> {
  const resolved = await Promise.all(
    rows.map(async (row) => {
      const imageUrl = await resolveOwnedImageFetchUrl(userId, {
        mediaAssetId: row.media_asset_id,
        imageUrl: row.image_url,
      });
      if (!imageUrl) return null;
      return {
        id: row.id,
        category: row.category,
        name: row.name,
        imageUrl,
      };
    }),
  );
  return resolved.filter(
    (row): row is NonNullable<typeof row> => row != null,
  );
}
