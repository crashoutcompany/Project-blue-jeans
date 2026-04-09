import type { ClothingCardData } from "@/lib/garments/types";

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

const HEX = /^#[0-9A-Fa-f]{6}$/i;

export function garmentRowToCardData(row: GarmentRow): ClothingCardData {
  const rawColor = row.color?.trim() || null;
  const isHex = rawColor ? HEX.test(rawColor) : false;
  const colorHex = isHex && rawColor ? rawColor : "#e8e8e6";

  return {
    id: row.id,
    name: row.name?.trim() || "Untitled",
    category: row.category,
    imageUrl: row.image_url,
    isFavorite: row.is_favorite,
    color: rawColor,
    colorHex,
    colorLabel: isHex ? undefined : rawColor ?? undefined,
    imageHint: "archive",
    description: row.description?.trim() || null,
  };
}
