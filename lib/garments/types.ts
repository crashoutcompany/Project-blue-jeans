import { z } from "zod";

export type GarmentCategoryDb = "tops" | "bottoms" | "shoes";

/** Values of Postgres `garment_category` (see db/schema.sql). */
export const GARMENT_CATEGORY_VALUES: readonly GarmentCategoryDb[] = [
  "tops",
  "bottoms",
  "shoes",
];

export const GARMENT_CATEGORY_LABEL: Record<GarmentCategoryDb, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  shoes: "Shoes",
};

export const garmentCategorySchema = z.enum(["tops", "bottoms", "shoes"]);

export function isGarmentCategoryDb(v: string): v is GarmentCategoryDb {
  return (GARMENT_CATEGORY_VALUES as readonly string[]).includes(v);
}

/** Hex color (#rrggbb) used on cards and color facets. */
export const GARMENT_HEX_COLOR = /^#[0-9A-Fa-f]{6}$/i;

export const clothingCardDataSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  category: garmentCategorySchema,
  imageUrl: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  color: z.string().nullable().optional(),
  colorLabel: z.string().optional(),
  colorHex: z.string().optional(),
  imageHint: z.string().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Shared shape for `ClothingCard` (closet DB rows). */
export type ClothingCardData = z.infer<typeof clothingCardDataSchema>;

export const updateGarmentFieldsResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    garment: clothingCardDataSchema,
  }),
  z.object({
    ok: z.literal(false),
    message: z.string(),
  }),
]);

export type UpdateGarmentFieldsResult = z.infer<
  typeof updateGarmentFieldsResultSchema
>;

export const deleteGarmentResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

export type DeleteGarmentResult = z.infer<typeof deleteGarmentResultSchema>;

export const createGarmentsResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    ids: z.array(z.string()),
  }),
  z.object({
    ok: z.literal(false),
    message: z.string(),
  }),
]);
