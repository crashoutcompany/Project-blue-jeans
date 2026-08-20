import { z } from "zod";

import type { MembershipPolicy } from "@/lib/auth/membership";
import { resolveUploadThingTokenForConnection } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { logServerError, safeClientMessage } from "@/lib/server/safe-client-error";
import type { DeleteGarmentResult } from "@/lib/garments/types";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";

const garmentIdSchema = z.string().uuid();

export type { DeleteGarmentResult };

/** Index of the `SELECT uploadthing_key … FOR UPDATE` statement in the txn. */
const SELECT_KEY_INDEX = 4;

/**
 * Run the delete's Postgres statements as one Neon HTTP transaction when
 * `sql.transaction` exists (production). Tests can omit it and await queries
 * in order. UploadThing stays outside — it is not Postgres.
 */
async function runSqlTransaction(
  sql: ReturnType<typeof requireSql>,
  queries: unknown[],
): Promise<unknown[]> {
  if (typeof sql.transaction === "function") {
    return sql.transaction(queries as never);
  }
  const results: unknown[] = [];
  for (const query of queries) {
    results.push(await query);
  }
  return results;
}

/**
 * Remove one closet garment for a Wearer: unlink from outfits, delete the
 * row, then delete the UploadThing object when a key exists.
 *
 * Closet / outfit rows commit together. The photo delete is best-effort after
 * that commit so a missing file never rolls back a successful closet remove.
 */
export async function deleteGarment(
  userId: string,
  garmentId: string,
  membership?: MembershipPolicy | null,
): Promise<DeleteGarmentResult> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }
  const parsed = garmentIdSchema.safeParse(garmentId.trim());
  if (!parsed.success) {
    return { ok: false, message: "Invalid garment." };
  }
  const id = parsed.data;

  try {
    const sql = requireSql();
    const results = await runSqlTransaction(sql, [
      sql`
        CREATE TEMP TABLE _del_garment_outfits (
          outfit_id uuid PRIMARY KEY
        ) ON COMMIT DROP
      `,
      sql`
        CREATE TEMP TABLE _del_garment_rekey (
          outfit_id uuid PRIMARY KEY,
          new_key text NOT NULL
        ) ON COMMIT DROP
      `,
      sql`
        CREATE TEMP TABLE _del_garment_merge (
          drop_id uuid PRIMARY KEY,
          keep_id uuid NOT NULL
        ) ON COMMIT DROP
      `,
      sql`
        INSERT INTO _del_garment_outfits (outfit_id)
        SELECT DISTINCT og.outfit_id
        FROM outfit_garments og
        INNER JOIN garments g ON g.id = og.garment_id
        WHERE g.id = ${id}::uuid
          AND g.user_id = ${userId}
      `,
      sql`
        SELECT
          g.uploadthing_key,
          g.media_asset_id,
          ma.connection_id
        FROM garments g
        LEFT JOIN media_assets ma ON ma.id = g.media_asset_id
        WHERE g.id = ${id}::uuid
          AND g.user_id = ${userId}
        FOR UPDATE OF g
      `,
      sql`
        DELETE FROM outfit_garments og
        USING garments g
        WHERE og.garment_id = g.id
          AND g.id = ${id}::uuid
          AND g.user_id = ${userId}
      `,
      sql`
        DELETE FROM outfits o
        USING _del_garment_outfits a
        WHERE o.id = a.outfit_id
          AND o.user_id = ${userId}
          AND NOT EXISTS (
            SELECT 1 FROM outfit_garments og WHERE og.outfit_id = o.id
          )
      `,
      sql`
        INSERT INTO _del_garment_rekey (outfit_id, new_key)
        SELECT o.id, keys.new_key
        FROM outfits o
        INNER JOIN _del_garment_outfits a ON a.outfit_id = o.id
        INNER JOIN LATERAL (
          SELECT string_agg(gid, ',' ORDER BY gid) AS new_key
          FROM (
            SELECT DISTINCT lower(trim(og.garment_id::text)) AS gid
            FROM outfit_garments og
            WHERE og.outfit_id = o.id
          ) s
          WHERE gid <> ''
        ) keys ON keys.new_key IS NOT NULL AND keys.new_key <> ''
        WHERE o.user_id = ${userId}
          AND EXISTS (
            SELECT 1 FROM outfit_garments og WHERE og.outfit_id = o.id
          )
      `,
      sql`
        INSERT INTO _del_garment_merge (drop_id, keep_id)
        SELECT r.outfit_id, k.keep_id
        FROM _del_garment_rekey r
        INNER JOIN LATERAL (
          SELECT COALESCE(
            (
              SELECT o.id
              FROM outfits o
              WHERE o.user_id = ${userId}
                AND o.garment_set_key = r.new_key
                AND o.id <> r.outfit_id
                AND NOT EXISTS (
                  SELECT 1 FROM _del_garment_rekey x WHERE x.outfit_id = o.id
                )
              LIMIT 1
            ),
            (
              SELECT r2.outfit_id
              FROM _del_garment_rekey r2
              WHERE r2.new_key = r.new_key
              ORDER BY r2.outfit_id
              LIMIT 1
            )
          ) AS keep_id
        ) k ON TRUE
        WHERE k.keep_id IS DISTINCT FROM r.outfit_id
      `,
      sql`
        DELETE FROM outfit_wears a
        USING outfit_wears b, _del_garment_merge m
        WHERE a.outfit_id = m.drop_id
          AND b.outfit_id = m.keep_id
          AND a.user_id = b.user_id
          AND a.worn_on = b.worn_on
      `,
      sql`
        UPDATE outfit_wears w
        SET outfit_id = m.keep_id
        FROM _del_garment_merge m
        WHERE w.outfit_id = m.drop_id
      `,
      sql`
        DELETE FROM outfits o
        USING _del_garment_merge m
        WHERE o.id = m.drop_id
          AND o.user_id = ${userId}
      `,
      sql`
        UPDATE outfits o
        SET
          garment_set_key = r.new_key,
          updated_at = now()
        FROM _del_garment_rekey r
        WHERE o.id = r.outfit_id
          AND o.user_id = ${userId}
          AND NOT EXISTS (
            SELECT 1 FROM _del_garment_merge m WHERE m.drop_id = r.outfit_id
          )
      `,
      sql`
        DELETE FROM garments
        WHERE id = ${id}::uuid
          AND user_id = ${userId}
        RETURNING id
      `,
    ]);

    const found = results[SELECT_KEY_INDEX] as
      | {
          uploadthing_key: string | null;
          media_asset_id: string | null;
          connection_id: string | null;
        }[]
      | undefined;
    const deleted = results.at(-1) as { id: string }[] | undefined;

    if (!found?.length || !deleted?.length) {
      return { ok: false, message: "Garment not found." };
    }
    const uploadthingKey = found[0]?.uploadthing_key?.trim() || null;
    const mediaAssetId = found[0]?.media_asset_id?.trim() || null;
    const connectionId = found[0]?.connection_id?.trim() || null;

    try {
      let remoteDeleted = true;
      if (uploadthingKey) {
        const resolved = await resolveUploadThingTokenForConnection(
          userId,
          connectionId,
          membership,
        );
        remoteDeleted = await deleteUploadThingFiles(
          [uploadthingKey],
          resolved.ok ? resolved.token : null,
        );
      }
      if (mediaAssetId && remoteDeleted) {
        await sql`
          DELETE FROM media_assets
          WHERE id = ${mediaAssetId}::uuid
            AND user_id = ${userId}
        `;
      }
    } catch (cleanupError) {
      logServerError("deleteGarment cleanup", cleanupError);
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "deleteGarment",
        e,
        "Could not remove that piece. Try again in a moment.",
      ),
    };
  }
}
