import type { ClothingCardData } from "@/lib/garments/types";
import { GARMENT_HEX_COLOR } from "@/lib/garments/types";

export type GarmentRow = {
  id: string;
  image_url: string;
  uploadthing_key: string | null;
  category: string;
  color: string | null;
  is_favorite: boolean;
  name: string | null;
  notes: string | null;
  description: string | null;
};

export function garmentRowToCardData(row: GarmentRow): ClothingCardData {
  const rawColor = row.color?.trim() || null;
  const isHex = rawColor ? GARMENT_HEX_COLOR.test(rawColor) : false;
  const colorHex = isHex && rawColor ? rawColor : "#e8e8e6";
  const category =
    row.category === "bottoms" || row.category === "shoes"
      ? row.category
      : "tops";

  return {
    id: row.id,
    name: row.name?.trim() || "Untitled",
    category,
    imageUrl: row.image_url,
    isFavorite: row.is_favorite,
    color: rawColor,
    colorHex,
    colorLabel: isHex ? undefined : (rawColor ?? undefined),
    imageHint: "archive",
    description: row.description?.trim() || null,
    notes: row.notes?.trim() || null,
  };
}
