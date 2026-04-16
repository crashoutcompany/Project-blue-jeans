"use server";

import { revalidateTag, updateTag } from "next/cache";

import { assertAdminForServerAction } from "@/lib/auth/admin";
import { CLOSET_GARMENTS_TAG } from "@/lib/garments/closet-garments-cache-tag";
import { requireSql } from "@/lib/db";
import { safeClientMessage } from "@/lib/server/safe-client-error";

function revalidateClosetGarmentsCache() {
  try {
    updateTag(CLOSET_GARMENTS_TAG);
    revalidateTag(CLOSET_GARMENTS_TAG, "max");
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
    `;
    revalidateClosetGarmentsCache();
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
