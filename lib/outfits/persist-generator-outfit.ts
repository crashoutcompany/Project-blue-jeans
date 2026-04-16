import { z } from "zod";

import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  APPROVE_OUTFIT_MAX_IMAGE_URL_LEN,
  APPROVE_OUTFIT_MAX_NAME,
} from "@/lib/outfits/approve-outfit-limits";
import { outfitOccasionSchema } from "@/lib/outfits/occasions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const approveGeneratorPayloadSchema = z.object({
  wornOn: isoDate,
  name: z.string().max(APPROVE_OUTFIT_MAX_NAME).optional(),
  occasion: outfitOccasionSchema.optional().default("casual"),
  garmentIds: z.array(z.string().uuid()).min(1).max(20),
  imageUrl: z
    .string()
    .max(APPROVE_OUTFIT_MAX_IMAGE_URL_LEN)
    .optional()
    .nullable(),
});

export type ApproveGeneratorPayload = z.infer<
  typeof approveGeneratorPayloadSchema
>;

export type ApproveOutfitResult =
  | { ok: true; outfitId: string }
  | { ok: false; message: string };

export async function insertOutfitWithGarments(input: {
  wornOn: string;
  name: string | null;
  occasion: z.infer<typeof outfitOccasionSchema>;
  imageUrl: string | null;
  garmentIds: string[];
}): Promise<string> {
  const sql = requireSql();

  const trimmedName =
    input.name?.trim().slice(0, APPROVE_OUTFIT_MAX_NAME) || null;
  const imageUrl =
    input.imageUrl && input.imageUrl.length <= APPROVE_OUTFIT_MAX_IMAGE_URL_LEN
      ? input.imageUrl
      : null;

  const rows = (await sql`
    INSERT INTO outfits (worn_on, occasion, name, image_url)
    VALUES (
      ${input.wornOn}::date,
      ${input.occasion}::outfit_occasion,
      ${trimmedName},
      ${imageUrl}
    )
    RETURNING id
  `) as { id: string }[];

  const outfitId = rows[0]?.id;
  if (!outfitId) {
    throw new Error("Insert outfit returned no id");
  }

  for (let i = 0; i < input.garmentIds.length; i++) {
    const gid = input.garmentIds[i]!;
    await sql`
      INSERT INTO outfit_garments (outfit_id, garment_id, sort_order)
      VALUES (${outfitId}::uuid, ${gid}::uuid, ${i})
      ON CONFLICT (outfit_id, garment_id) DO NOTHING
    `;
  }

  return outfitId;
}

/** DB write for a generator look — call from Route Handlers or server actions after auth. */
export async function executeApproveGeneratorOutfit(
  data: ApproveGeneratorPayload,
): Promise<ApproveOutfitResult> {
  const { wornOn, name, occasion, garmentIds, imageUrl } = data;

  try {
    const sql = requireSql();
    const uniqueIds = [...new Set(garmentIds)];
    const countRows = (await sql`
      SELECT count(*)::int AS n
      FROM garments
      WHERE id = ANY(${uniqueIds})
    `) as { n: number }[];
    if ((countRows[0]?.n ?? 0) !== uniqueIds.length) {
      return {
        ok: false,
        message: "One or more garments are missing from your closet.",
      };
    }

    const outfitId = await insertOutfitWithGarments({
      wornOn,
      name: name ?? null,
      occasion,
      imageUrl: imageUrl ?? null,
      garmentIds: uniqueIds,
    });

    return { ok: true, outfitId };
  } catch (e) {
    logServerError("executeApproveGeneratorOutfit", e);
    return {
      ok: false,
      message: "Could not save this outfit. Try again.",
    };
  }
}
