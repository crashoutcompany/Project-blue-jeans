export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "shoes"
  | "accessories"
  | "outerwear"
  | "knitwear";

export type Garment = {
  id: string;
  name: string;
  category: GarmentCategory;
  material: string;
  occasion: string;
  colorLabel: string;
  colorHex: string;
  imageHint: string;
};

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
