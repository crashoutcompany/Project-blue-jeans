"use server";

import { revalidateTag, updateTag } from "next/cache";

import { assertAdminForServerAction } from "@/lib/auth/admin";
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
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  try {
    const sql = requireSql();
    await sql`
      UPDATE garments
      SET
        is_favorite = NOT is_favorite,
        updated_at = now()
      WHERE id = ${id}
        AND user_id = ${gate.userId}
    `;
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
