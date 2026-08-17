import { z } from "zod";

/** A single Fit option from Outfit Generator (before commit). */
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

export const outfitLookSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  featured: z.boolean().optional(),
  garmentIds: z.array(z.string()).optional(),
  imageDataUrl: z.string().optional(),
});

export const generateLookbookResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    looks: z.array(outfitLookSchema),
    curatorNote: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    message: z.string(),
  }),
]);
