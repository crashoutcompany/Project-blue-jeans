export type GarmentCategoryDb = "tops" | "bottoms" | "shoes";

/** Values of Postgres `garment_category` (see db/schema.sql). */
export const GARMENT_CATEGORY_VALUES: readonly GarmentCategoryDb[] = [
  "tops",
  "bottoms",
  "shoes",
];

export function isGarmentCategoryDb(v: string): v is GarmentCategoryDb {
  return (GARMENT_CATEGORY_VALUES as readonly string[]).includes(v);
}

/** Shared shape for `ClothingCard` (closet DB rows + dashboard mock items). */
export type ClothingCardData = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string | null;
  isFavorite?: boolean;
  /** DB `garments.color`: hex (#rrggbb) or free-text label */
  color?: string | null;
  material?: string;
  occasion?: string;
  colorLabel?: string;
  colorHex?: string;
  imageHint?: string;
  /** DB `garments.description` for AI closet catalog */
  description?: string | null;
};
