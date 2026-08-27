"use server";

import { revalidateTag, updateTag } from "next/cache";
import { z } from "zod";

import { assertAdmittedForServerAction } from "@/lib/auth/admitted";
import { closetGarmentsTag } from "@/lib/garments/closet-garments-cache-tag";
import { requireSql } from "@/lib/db";
import { safeClientMessage } from "@/lib/server/safe-client-error";

function revalidateClosetGarmentsCache(userId: string) {
  try {
    const tag = closetGarmentsTag(userId);
    updateTag(tag);
    revalidateTag(tag, "max");
  } catch (e) {
    console.error("[garments] revalidateClosetGarmentsCache failed", e);
  }
}

export type ToggleFavoriteResult =
  | { ok: true }
  | { ok: false; message: string };

export async function toggleGarmentFavorite(
  id: string,
): Promise<ToggleFavoriteResult> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  // A non-uuid would otherwise reach Postgres and come back as a generic
  // "could not update" rather than a clear rejection.
  const idParse = z.string().uuid().safeParse(id);
  if (!idParse.success) {
    return { ok: false, message: "Invalid garment id." };
  }
  try {
    const sql = requireSql();
    const rows = await sql`
      UPDATE garments
      SET
        is_favorite = NOT is_favorite,
        updated_at = now()
      WHERE id = ${idParse.data}::uuid
        AND user_id = ${gate.userId}
      RETURNING id
    `;
    // Without checking the result an unknown or non-owned id reported success,
    // leaving the optimistic UI showing a favorite that was never stored.
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, message: "That piece was not found." };
    }
    revalidateClosetGarmentsCache(gate.userId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: safeClientMessage(
        "toggleGarmentFavorite",
        e,
        "Could not update that favorite. Try again in a moment.",
      ),
    };
  }
}
