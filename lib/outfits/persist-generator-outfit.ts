import { z } from "zod";

import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  APPROVE_OUTFIT_MAX_IMAGE_URL_LEN,
  APPROVE_OUTFIT_MAX_NAME,
} from "@/lib/outfits/approve-outfit-limits";
import { garmentSetKey } from "@/lib/outfits/garment-set-key";
import { outfitOccasionSchema } from "@/lib/outfits/occasions";
import { assertMutableWornOn } from "@/lib/time/mutable-calendar-day";

export const approveGeneratorPayloadSchema = z.object({
  wornOn: z.iso.date(),
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

const idRowSchema = z.object({ id: z.string().uuid() });
const priorWearRowSchema = z.object({
  prior_outfit_id: z.string().uuid(),
});
const wearDeleteRowSchema = z.object({
  outfit_id: z.string().uuid(),
});
const countRowSchema = z.object({ n: z.number().int() });

export function normalizeCommitImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  return url.length <= APPROVE_OUTFIT_MAX_IMAGE_URL_LEN ? url : null;
}

export async function assertGarmentsOwnedByUser(
  userId: string,
  garmentIds: string[],
): Promise<ApproveOutfitResult | null> {
  const uniqueIds = [...new Set(garmentIds)];
  if (uniqueIds.length === 0) {
    return {
      ok: false,
      message: "This look has no linked garments to save.",
    };
  }
  const sql = requireSql();
  const countRows = await sql`
    SELECT count(*)::int AS n
    FROM garments
    WHERE user_id = ${userId}
      AND id = ANY(${uniqueIds})
  `;
  const parsed = z.array(countRowSchema).safeParse(countRows);
  const n = parsed.success ? (parsed.data[0]?.n ?? 0) : 0;
  if (n !== uniqueIds.length) {
    return {
      ok: false,
      message: "One or more garments are missing from your closet.",
    };
  }
  return null;
}

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
 * Atomically replace the wear for (user_id, worn_on) and return the previous
 * outfit id (when different) for orphan cleanup. Requires UNIQUE (user_id, worn_on).
 */
async function replaceWearForDay(
  userId: string,
  wornOn: string,
  outfitId: string,
): Promise<string | null> {
  const sql = requireSql();
  const rows = await sql`
    WITH deleted AS (
      DELETE FROM outfit_wears
      WHERE user_id = ${userId}
        AND worn_on = ${wornOn}::date
      RETURNING outfit_id::text AS prior_outfit_id
    ),
    inserted AS (
      INSERT INTO outfit_wears (outfit_id, user_id, worn_on)
      VALUES (${outfitId}::uuid, ${userId}, ${wornOn}::date)
      ON CONFLICT (user_id, worn_on) DO UPDATE
        SET outfit_id = EXCLUDED.outfit_id
      RETURNING 1
    )
    SELECT prior_outfit_id FROM deleted
  `;
  const parsed = z.array(priorWearRowSchema).safeParse(rows);
  const prior = parsed.success ? (parsed.data[0]?.prior_outfit_id ?? null) : null;
  return prior && prior !== outfitId ? prior : null;
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

  const imageUrl = normalizeCommitImageUrl(input.imageUrl);
  const occasion = input.occasion ?? "casual";

  const existingRaw = await sql`
    SELECT id FROM outfits
    WHERE user_id = ${input.userId}
      AND garment_set_key = ${setKey}
    LIMIT 1
  `;
  const existingParsed = z.array(idRowSchema).safeParse(existingRaw);
  let outfitId = existingParsed.success
    ? (existingParsed.data[0]?.id ?? null)
    : null;

  if (!outfitId) {
    const inserted = await sql`
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
    `;
    const insertedParsed = z.array(idRowSchema).parse(inserted);
    outfitId = insertedParsed[0]?.id ?? null;
    if (!outfitId) {
      throw new Error("Insert outfit returned no id");
    }

    for (let i = 0; i < uniqueIds.length; i++) {
      const gid = uniqueIds[i];
      if (!gid) continue;
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

  const priorOutfitId = await replaceWearForDay(
    input.userId,
    input.wornOn,
    outfitId,
  );

  await syncLastWorn(outfitId);

  if (priorOutfitId) {
    await syncLastWorn(priorOutfitId);
    await deleteOutfitIfOrphaned(input.userId, priorOutfitId);
  }

  return outfitId;
}

/** Assign an existing Closet Outfit to a calendar day (Wear today). */
export async function assignOutfitToDay(input: {
  userId: string;
  outfitId: string;
  wornOn: string;
}): Promise<ApproveOutfitResult> {
  try {
    const sql = requireSql();
    const rows = await sql`
      SELECT id FROM outfits
      WHERE id = ${input.outfitId}::uuid
        AND user_id = ${input.userId}
      LIMIT 1
    `;
    const parsed = z.array(idRowSchema).safeParse(rows);
    if (!parsed.success || !parsed.data[0]) {
      return { ok: false, message: "That outfit was not found." };
    }

    const priorOutfitId = await replaceWearForDay(
      input.userId,
      input.wornOn,
      input.outfitId,
    );

    await syncLastWorn(input.outfitId);

    if (priorOutfitId) {
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
    const rows = await sql`
      DELETE FROM outfit_wears
      WHERE user_id = ${userId}
        AND worn_on = ${wornOn}::date
      RETURNING outfit_id::text AS outfit_id
    `;
    const parsed = z.array(wearDeleteRowSchema).safeParse(rows);
    const outfitId = parsed.success ? parsed.data[0]?.outfit_id : undefined;
    if (outfitId) {
      await syncLastWorn(outfitId);
      await deleteOutfitIfOrphaned(userId, outfitId);
    }

    return { ok: true, outfitId: outfitId ?? "" };
  } catch (e) {
    logServerError("unwearDay", e);
    return { ok: false, message: "Could not unwear this look." };
  }
}

/** DB write for a generator look — call from Route Handlers or server actions after auth. */
export async function executeApproveGeneratorOutfit(
  userId: string,
  data: ApproveGeneratorPayload,
): Promise<ApproveOutfitResult> {
  const { wornOn, occasion, garmentIds, imageUrl } = data;
  const mutable = assertMutableWornOn(wornOn);
  if (!mutable.ok) return mutable;

  try {
    const uniqueIds = [...new Set(garmentIds)];
    const ownership = await assertGarmentsOwnedByUser(userId, uniqueIds);
    if (ownership) return ownership;

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
