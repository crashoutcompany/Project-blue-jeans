"use server";

import { z } from "zod";

import { assertAdmittedForServerAction } from "@/lib/auth/admitted";
import { revalidateOutfitSurfaces } from "@/lib/cache/revalidate-wearer-surfaces";
import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import { APPROVE_OUTFIT_MAX_NAME } from "@/lib/outfits/approve-outfit-limits";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import {
  assignOutfitToDay,
  type ApproveOutfitResult,
} from "@/lib/outfits/persist-generator-outfit";
import { promoteWeeklyFitToOutfit } from "@/lib/outfits/promote-fit";
import { productTodayIso } from "@/lib/time/product-timezone";
import { revalidatePath, revalidateTag } from "next/cache";

export type { ApproveOutfitResult };

/**
 * Promotes a weekly plan day look into a shared Outfit + wear for that day.
 */
export async function approveWeeklyPlanLook(
  planLookId: string,
): Promise<ApproveOutfitResult> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  const idParse = z.string().uuid().safeParse(planLookId);
  if (!idParse.success) {
    return { ok: false, message: "Invalid plan look id." };
  }

  const result = await promoteWeeklyFitToOutfit(gate.userId, idParse.data);
  if (result.ok) revalidateOutfitSurfaces(gate.userId);
  return result;
}

/**
 * Closet → Outfits detail: assign an archived Outfit to today.
 */
export async function wearOutfitToday(
  outfitId: string,
): Promise<ApproveOutfitResult> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  const idParse = z.string().uuid().safeParse(outfitId);
  if (!idParse.success) {
    return { ok: false, message: "Invalid outfit id." };
  }

  const result = await assignOutfitToDay({
    userId: gate.userId,
    outfitId: idParse.data,
    wornOn: productTodayIso(),
  });
  if (result.ok) revalidateOutfitSurfaces(gate.userId);
  return result;
}

/** Closet → Outfits detail: user-only name. */
export async function renameOutfit(
  outfitId: string,
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  const idParse = z.string().uuid().safeParse(outfitId);
  if (!idParse.success) {
    return { ok: false, message: "Invalid outfit id." };
  }

  const trimmed = name.trim().slice(0, APPROVE_OUTFIT_MAX_NAME);
  const stored = trimmed.length > 0 ? trimmed : null;

  try {
    const sql = requireSql();
    const rows = await sql`
      UPDATE outfits
      SET name = ${stored}, updated_at = now()
      WHERE id = ${idParse.data}::uuid
        AND user_id = ${gate.userId}
      RETURNING id
    `;
    const parsed = z
      .array(z.object({ id: z.string().uuid() }))
      .safeParse(rows);
    if (!parsed.success || !parsed.data[0]) {
      return { ok: false, message: "That outfit was not found." };
    }
    revalidateTag(closetSavedOutfitsTag(gate.userId), "max");
    revalidatePath("/closet");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    logServerError("renameOutfit", e);
    return { ok: false, message: "Could not rename this outfit." };
  }
}

/** Today’s committed Outfit id, if any (for Wear today replace confirm). */
export async function getTodaysOutfitId(): Promise<string | null> {
  const gate = await assertAdmittedForServerAction();
  if (!gate.ok) return null;
  try {
    const sql = requireSql();
    const todayIso = productTodayIso();
    const rows = await sql`
      SELECT outfit_id::text AS outfit_id
      FROM outfit_wears
      WHERE user_id = ${gate.userId}
        AND worn_on = ${todayIso}::date
      LIMIT 1
    `;
    const parsed = z
      .array(z.object({ outfit_id: z.string().uuid() }))
      .safeParse(rows);
    return parsed.success ? (parsed.data[0]?.outfit_id ?? null) : null;
  } catch {
    return null;
  }
}
