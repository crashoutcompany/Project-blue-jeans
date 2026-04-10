/** A single look from lookbook generation (step 1 + optional hero image). */
export type OutfitLook = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  featured?: boolean;
  /** Garment UUIDs chosen in step 1 (closet). */
  garmentIds?: string[];
  /** Base64 data URL from Gemini image generation (featured look only). */
  imageDataUrl?: string;
};
