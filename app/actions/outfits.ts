"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { assertAdminForServerAction } from "@/lib/auth/admin";
import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";
import {
  APPROVE_OUTFIT_MAX_IMAGE_URL_LEN,
  APPROVE_OUTFIT_MAX_NAME,
} from "@/lib/outfits/approve-outfit-limits";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import {
  assignOutfitToDay,
  commitOutfitForDay,
  type ApproveOutfitResult,
} from "@/lib/outfits/persist-generator-outfit";
import { productTodayIso } from "@/lib/time/product-timezone";

export type { ApproveOutfitResult };

function revalidateOutfitSurfaces(userId: string) {
  revalidateTag(closetSavedOutfitsTag(userId), "max");
  revalidateTag(calendarMonthTag(userId), "max");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/closet");
}

/**
 * Promotes a weekly plan day look into a shared Outfit + wear for that day.
 */
export async function approveWeeklyPlanLook(
  planLookId: string,
): Promise<ApproveOutfitResult> {
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  const idParse = z.string().uuid().safeParse(planLookId);
  if (!idParse.success) {
    return { ok: false, message: "Invalid plan look id." };
  }

  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT
        l.id,
        l.hero_image_url,
        l.garment_ids,
        (p.week_start + l.sort_order)::text AS worn_on
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE l.id = ${planLookId}::uuid
        AND p.user_id = ${gate.userId}
      LIMIT 1
    `) as {
      id: string;
      hero_image_url: string | null;
      garment_ids: string[] | null;
      worn_on: string;
    }[];

    const row = rows[0];
    if (!row) {
      return { ok: false, message: "That weekly look was not found." };
    }

    const garmentIds = Array.isArray(row.garment_ids)
      ? [...new Set(row.garment_ids)]
      : [];
    if (garmentIds.length === 0) {
      return {
        ok: false,
        message: "This look has no linked garments to save.",
      };
    }

    const countRows = (await sql`
      SELECT count(*)::int AS n
      FROM garments
      WHERE user_id = ${gate.userId}
        AND id = ANY(${garmentIds})
    `) as { n: number }[];
    if ((countRows[0]?.n ?? 0) !== garmentIds.length) {
      return {
        ok: false,
        message: "One or more garments are missing from your closet.",
      };
    }

    const imageUrl =
      row.hero_image_url &&
      row.hero_image_url.length <= APPROVE_OUTFIT_MAX_IMAGE_URL_LEN
        ? row.hero_image_url
        : null;

    const outfitId = await commitOutfitForDay({
      userId: gate.userId,
      wornOn: row.worn_on,
      garmentIds,
      imageUrl,
      occasion: "casual",
    });

    revalidateOutfitSurfaces(gate.userId);
    return { ok: true, outfitId };
  } catch (e) {
    logServerError("approveWeeklyPlanLook", e);
    return {
      ok: false,
      message: "Could not approve this look. Try again.",
    };
  }
}

/**
 * Closet → Outfits detail: assign an archived Outfit to today.
 */
export async function wearOutfitToday(
  outfitId: string,
): Promise<ApproveOutfitResult> {
  const gate = await assertAdminForServerAction();
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
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return { ok: false, message: gate.message };
  const idParse = z.string().uuid().safeParse(outfitId);
  if (!idParse.success) {
    return { ok: false, message: "Invalid outfit id." };
  }

  const trimmed = name.trim().slice(0, APPROVE_OUTFIT_MAX_NAME);
  const stored = trimmed.length > 0 ? trimmed : null;

  try {
    const sql = requireSql();
    const rows = (await sql`
      UPDATE outfits
      SET name = ${stored}, updated_at = now()
      WHERE id = ${idParse.data}::uuid
        AND user_id = ${gate.userId}
      RETURNING id
    `) as { id: string }[];
    if (!rows[0]) {
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
  const gate = await assertAdminForServerAction();
  if (!gate.ok) return null;
  try {
    const sql = requireSql();
    const todayIso = productTodayIso();
    const rows = (await sql`
      SELECT outfit_id::text AS outfit_id
      FROM outfit_wears
      WHERE user_id = ${gate.userId}
        AND worn_on = ${todayIso}::date
      LIMIT 1
    `) as { outfit_id: string }[];
    return rows[0]?.outfit_id ?? null;
  } catch {
    return null;
  }
}
