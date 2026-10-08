import { z } from "zod";

import { requireSql } from "@/lib/db";
import { getOwnedMediaAsset } from "@/lib/media/assets";
import {
  mediaAssetDisplayPath,
  parseMediaAssetIdFromPath,
} from "@/lib/media/display";
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
const countRowSchema = z.object({ n: z.number().int() });

/** Server-trusted hero values (e.g. a stored Weekly Fit); empty → null. */
export function normalizeCommitImageUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Client-supplied hero: keep it only when it is this Wearer's own generated
 * `outfit_hero` asset. Anything else is dropped; the outfit falls back to
 * garment thumbnails (or keeps the hero already stored for that garment set).
 */
export async function ownedHeroImagePath(
  userId: string,
  url: string | null | undefined,
): Promise<string | null> {
  const mediaAssetId = parseMediaAssetIdFromPath(url ?? "");
  if (!mediaAssetId) return null;
  const asset = await getOwnedMediaAsset(userId, mediaAssetId);
  if (!asset || asset.kind !== "outfit_hero") return null;
  return mediaAssetDisplayPath(asset.id);
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

type Sql = ReturnType<typeof requireSql>;

/**
 * Run statements in one Neon transaction so a failure part-way cannot leave a
 * wear without its last-worn sync or an orphaned Outfit behind.
 */
function runInTransaction(
  sql: Sql,
  queries: ReturnType<Sql>[],
): Promise<unknown[]> {
  return sql.transaction(queries);
}

/**
 * Outfit currently worn on (user_id, worn_on). Read before the write
 * transaction because Neon HTTP transactions cannot feed one statement's
 * result into the next. If a concurrent write changes the day in between, the
 * cleanup below is a guarded no-op on the stale id; at worst an Outfit with
 * no wears is left for the next commit on that day to tidy.
 */
async function wornOutfitIdForDay(
  sql: Sql,
  userId: string,
  wornOn: string,
): Promise<string | null> {
  const rows = await sql`
    SELECT outfit_id::text AS prior_outfit_id
    FROM outfit_wears
    WHERE user_id = ${userId}
      AND worn_on = ${wornOn}::date
    LIMIT 1
  `;
  const parsed = z.array(priorWearRowSchema).safeParse(rows);
  return parsed.success ? (parsed.data[0]?.prior_outfit_id ?? null) : null;
}

/**
 * Point (user_id, worn_on) at an Outfit. Relies on UNIQUE (user_id, worn_on);
 * see db/schema.sql.
 */
function upsertWearQuery(
  sql: Sql,
  userId: string,
  wornOn: string,
  outfitId: string,
) {
  return sql`
    INSERT INTO outfit_wears (outfit_id, user_id, worn_on)
    VALUES (${outfitId}::uuid, ${userId}, ${wornOn}::date)
    ON CONFLICT (user_id, worn_on)
    DO UPDATE SET outfit_id = EXCLUDED.outfit_id
  `;
}

function syncLastWornQuery(sql: Sql, outfitId: string) {
  return sql`
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

function deleteOutfitIfOrphanedQuery(
  sql: Sql,
  userId: string,
  outfitId: string,
) {
  return sql`
    DELETE FROM outfits o
    WHERE o.id = ${outfitId}::uuid
      AND o.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM outfit_wears w WHERE w.outfit_id = o.id
      )
  `;
}

/** Last-worn sync + orphan cleanup for an Outfit that just lost a day. */
function releasedOutfitQueries(
  sql: Sql,
  userId: string,
  outfitId: string | null,
  keepOutfitId?: string,
) {
  if (!outfitId || outfitId === keepOutfitId) return [];
  return [
    syncLastWornQuery(sql, outfitId),
    deleteOutfitIfOrphanedQuery(sql, userId, outfitId),
  ];
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

  const priorOutfitId = await wornOutfitIdForDay(
    sql,
    input.userId,
    input.wornOn,
  );

  /**
   * The first statement writes the outfit and its garment links together. A
   * SELECT-then-INSERT here raced `outfits_user_garment_set_key_uidx`, and
   * linking pieces in a follow-up loop could leave an outfit whose
   * `garment_set_key` claims pieces that `outfit_garments` never got. The
   * link insert also runs on the reuse path, so any set left partial by an
   * earlier failure is repaired on the next commit. Later statements find the
   * outfit by its set key, since its id is not known until the commit runs.
   */
  const [committed] = await runInTransaction(sql, [
    sql`
      WITH upserted AS (
        INSERT INTO outfits (worn_on, occasion, name, image_url, garment_set_key, user_id)
        VALUES (
          ${input.wornOn}::date,
          ${occasion}::outfit_occasion,
          NULL,
          ${imageUrl},
          ${setKey},
          ${input.userId}
        )
        ON CONFLICT (user_id, garment_set_key)
          WHERE garment_set_key IS NOT NULL AND garment_set_key <> ''
        DO UPDATE SET
          image_url = COALESCE(EXCLUDED.image_url, outfits.image_url),
          updated_at = now()
        RETURNING id
      ),
      linked AS (
        INSERT INTO outfit_garments (outfit_id, garment_id, sort_order)
        SELECT upserted.id, piece.garment_id, (piece.ord - 1)::int
        FROM upserted
        CROSS JOIN unnest(${uniqueIds}::uuid[])
          WITH ORDINALITY AS piece(garment_id, ord)
        ON CONFLICT (outfit_id, garment_id) DO NOTHING
        RETURNING 1
      )
      SELECT id FROM upserted
    `,
    sql`
      INSERT INTO outfit_wears (outfit_id, user_id, worn_on)
      SELECT o.id, ${input.userId}, ${input.wornOn}::date
      FROM outfits o
      WHERE o.user_id = ${input.userId}
        AND o.garment_set_key = ${setKey}
      ON CONFLICT (user_id, worn_on)
      DO UPDATE SET outfit_id = EXCLUDED.outfit_id
    `,
    sql`
      UPDATE outfits o
      SET
        worn_on = coalesce(
          (SELECT max(w.worn_on) FROM outfit_wears w WHERE w.outfit_id = o.id),
          o.worn_on
        ),
        updated_at = now()
      WHERE o.user_id = ${input.userId}
        AND o.garment_set_key = ${setKey}
    `,
    ...releasedOutfitQueries(sql, input.userId, priorOutfitId),
  ]);
  const committedParsed = z.array(idRowSchema).parse(committed);
  const outfitId = committedParsed[0]?.id ?? null;
  if (!outfitId) {
    throw new Error("Commit outfit returned no id");
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

    const priorOutfitId = await wornOutfitIdForDay(
      sql,
      input.userId,
      input.wornOn,
    );

    await runInTransaction(sql, [
      upsertWearQuery(sql, input.userId, input.wornOn, input.outfitId),
      syncLastWornQuery(sql, input.outfitId),
      ...releasedOutfitQueries(
        sql,
        input.userId,
        priorOutfitId,
        input.outfitId,
      ),
    ]);

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
    const outfitId = await wornOutfitIdForDay(sql, userId, wornOn);
    if (!outfitId) return { ok: true, outfitId: "" };

    await runInTransaction(sql, [
      sql`
        DELETE FROM outfit_wears
        WHERE user_id = ${userId}
          AND worn_on = ${wornOn}::date
      `,
      ...releasedOutfitQueries(sql, userId, outfitId),
    ]);

    return { ok: true, outfitId };
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
      imageUrl: await ownedHeroImagePath(userId, imageUrl),
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
