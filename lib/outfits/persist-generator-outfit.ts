import { z } from "zod";

import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  APPROVE_OUTFIT_MAX_IMAGE_URL_LEN,
  APPROVE_OUTFIT_MAX_NAME,
} from "@/lib/outfits/approve-outfit-limits";
import { garmentSetKey } from "@/lib/outfits/garment-set-key";
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

async function deleteOutfitIfOrphaned(
  userId: string,
  outfitId: string,
): Promise<void> {
  const sql = requireSql();
  await sql`
    DELETE FROM outfits o
    WHERE o.id = ${outfitId}::uuid
      AND o.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM outfit_wears w WHERE w.outfit_id = o.id
      )
  `;
}

async function syncLastWorn(outfitId: string): Promise<void> {
  const sql = requireSql();
  await sql`
    UPDATE outfits o
    SET
      worn_on = coalesce(
        (SELECT max(w.worn_on) FROM outfit_wears w WHERE w.outfit_id = o.id),
        o.worn_on
      ),
      updated_at = now()
    WHERE o.id = ${outfitId}::uuid
  `;
}

/**
 * Commit a garment set to a calendar day for one Wearer account.
 */
export async function commitOutfitForDay(input: {
  userId: string;
  wornOn: string;
  garmentIds: string[];
  imageUrl?: string | null;
  occasion?: z.infer<typeof outfitOccasionSchema>;
}): Promise<string> {
  const sql = requireSql();
  const uniqueIds = [...new Set(input.garmentIds)];
  const setKey = garmentSetKey(uniqueIds);
  if (!setKey) {
    throw new Error("Cannot commit an outfit with no garments");
  }
  if (!input.userId) {
    throw new Error("Missing user id");
  }

  const imageUrl =
    input.imageUrl && input.imageUrl.length <= APPROVE_OUTFIT_MAX_IMAGE_URL_LEN
      ? input.imageUrl
      : null;
  const occasion = input.occasion ?? "casual";

  const existingRows = (await sql`
    SELECT id FROM outfits
    WHERE user_id = ${input.userId}
      AND garment_set_key = ${setKey}
    LIMIT 1
  `) as { id: string }[];

  let outfitId = existingRows[0]?.id ?? null;

  if (!outfitId) {
    const inserted = (await sql`
      INSERT INTO outfits (worn_on, occasion, name, image_url, garment_set_key, user_id)
      VALUES (
        ${input.wornOn}::date,
        ${occasion}::outfit_occasion,
        NULL,
        ${imageUrl},
        ${setKey},
        ${input.userId}
      )
      RETURNING id
    `) as { id: string }[];
    outfitId = inserted[0]?.id ?? null;
    if (!outfitId) {
      throw new Error("Insert outfit returned no id");
    }

    for (let i = 0; i < uniqueIds.length; i++) {
      const gid = uniqueIds[i]!;
      await sql`
        INSERT INTO outfit_garments (outfit_id, garment_id, sort_order)
        VALUES (${outfitId}::uuid, ${gid}::uuid, ${i})
        ON CONFLICT (outfit_id, garment_id) DO NOTHING
      `;
    }
  } else if (imageUrl) {
    await sql`
      UPDATE outfits
      SET image_url = ${imageUrl}, updated_at = now()
      WHERE id = ${outfitId}::uuid
        AND user_id = ${input.userId}
    `;
  }

  const priorWear = (await sql`
    SELECT outfit_id::text AS outfit_id
    FROM outfit_wears
    WHERE user_id = ${input.userId}
      AND worn_on = ${input.wornOn}::date
    LIMIT 1
  `) as { outfit_id: string }[];
  const priorOutfitId = priorWear[0]?.outfit_id ?? null;

  await sql`
    INSERT INTO outfit_wears (outfit_id, user_id, worn_on)
    VALUES (${outfitId}::uuid, ${input.userId}, ${input.wornOn}::date)
    ON CONFLICT (user_id, worn_on) DO UPDATE
      SET outfit_id = EXCLUDED.outfit_id
  `;

  await syncLastWorn(outfitId);

  if (priorOutfitId && priorOutfitId !== outfitId) {
    await syncLastWorn(priorOutfitId);
    await deleteOutfitIfOrphaned(input.userId, priorOutfitId);
  }

  return outfitId;
}

/** @deprecated Prefer commitOutfitForDay */
export async function insertOutfitWithGarments(input: {
  userId: string;
  wornOn: string;
  name: string | null;
  occasion: z.infer<typeof outfitOccasionSchema>;
  imageUrl: string | null;
  garmentIds: string[];
}): Promise<string> {
  void input.name;
  return commitOutfitForDay({
    userId: input.userId,
    wornOn: input.wornOn,
    garmentIds: input.garmentIds,
    imageUrl: input.imageUrl,
    occasion: input.occasion,
  });
}

/** Assign an existing Closet Outfit to a calendar day (Wear today). */
export async function assignOutfitToDay(input: {
  userId: string;
  outfitId: string;
  wornOn: string;
}): Promise<ApproveOutfitResult> {
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT id FROM outfits
      WHERE id = ${input.outfitId}::uuid
        AND user_id = ${input.userId}
      LIMIT 1
    `) as { id: string }[];
    if (!rows[0]) {
      return { ok: false, message: "That outfit was not found." };
    }

    const priorWear = (await sql`
      SELECT outfit_id::text AS outfit_id
      FROM outfit_wears
      WHERE user_id = ${input.userId}
        AND worn_on = ${input.wornOn}::date
      LIMIT 1
    `) as { outfit_id: string }[];
    const priorOutfitId = priorWear[0]?.outfit_id ?? null;

    await sql`
      INSERT INTO outfit_wears (outfit_id, user_id, worn_on)
      VALUES (${input.outfitId}::uuid, ${input.userId}, ${input.wornOn}::date)
      ON CONFLICT (user_id, worn_on) DO UPDATE
        SET outfit_id = EXCLUDED.outfit_id
    `;

    await syncLastWorn(input.outfitId);

    if (priorOutfitId && priorOutfitId !== input.outfitId) {
      await syncLastWorn(priorOutfitId);
      await deleteOutfitIfOrphaned(input.userId, priorOutfitId);
    }

    return { ok: true, outfitId: input.outfitId };
  } catch (e) {
    logServerError("assignOutfitToDay", e);
    return { ok: false, message: "Could not wear this outfit. Try again." };
  }
}

/** Detach a day’s Outfit; remove archive entry if it has no other wears. */
export async function unwearDay(
  userId: string,
  wornOn: string,
): Promise<ApproveOutfitResult> {
  try {
    const sql = requireSql();
    const rows = (await sql`
      DELETE FROM outfit_wears
      WHERE user_id = ${userId}
        AND worn_on = ${wornOn}::date
      RETURNING outfit_id::text AS outfit_id
    `) as { outfit_id: string }[];

    const outfitId = rows[0]?.outfit_id;
    if (outfitId) {
      await syncLastWorn(outfitId);
      await deleteOutfitIfOrphaned(userId, outfitId);
    }

    return { ok: true, outfitId: outfitId ?? "" };
  } catch (e) {
    logServerError("unwearDay", e);
    return { ok: false, message: "Could not unwear today’s look." };
  }
}

/** DB write for a generator look — call from Route Handlers or server actions after auth. */
export async function executeApproveGeneratorOutfit(
  userId: string,
  data: ApproveGeneratorPayload,
): Promise<ApproveOutfitResult> {
  const { wornOn, occasion, garmentIds, imageUrl } = data;

  try {
    const sql = requireSql();
    const uniqueIds = [...new Set(garmentIds)];
    const countRows = (await sql`
      SELECT count(*)::int AS n
      FROM garments
      WHERE user_id = ${userId}
        AND id = ANY(${uniqueIds})
    `) as { n: number }[];
    if ((countRows[0]?.n ?? 0) !== uniqueIds.length) {
      return {
        ok: false,
        message: "One or more garments are missing from your closet.",
      };
    }

    const outfitId = await commitOutfitForDay({
      userId,
      wornOn,
      garmentIds: uniqueIds,
      imageUrl: imageUrl ?? null,
      occasion,
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
