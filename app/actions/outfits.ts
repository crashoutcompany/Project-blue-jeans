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
import { CALENDAR_MONTH_TAG } from "@/lib/outfits/calendar-month-cache-tag";
import { CLOSET_SAVED_OUTFITS_TAG } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import {
  insertOutfitWithGarments,
  type ApproveOutfitResult,
} from "@/lib/outfits/persist-generator-outfit";

export type { ApproveOutfitResult };

/**
 * Promotes a weekly plan day look into `outfits` (+ `outfit_garments`).
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
        l.title,
        l.hero_image_url,
        l.garment_ids,
        (p.week_start + l.sort_order)::text AS worn_on
      FROM weekly_plan_looks l
      INNER JOIN weekly_outfit_plans p ON p.id = l.plan_id
      WHERE l.id = ${planLookId}::uuid
      LIMIT 1
    `) as {
      id: string;
      title: string;
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
      WHERE id = ANY(${garmentIds})
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

    const outfitId = await insertOutfitWithGarments({
      wornOn: row.worn_on,
      name: row.title.trim().slice(0, APPROVE_OUTFIT_MAX_NAME) || null,
      occasion: "casual",
      imageUrl,
      garmentIds,
    });

    revalidateTag(CLOSET_SAVED_OUTFITS_TAG, "max");
    revalidateTag(CALENDAR_MONTH_TAG, "max");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { ok: true, outfitId };
  } catch (e) {
    logServerError("approveWeeklyPlanLook", e);
    return {
      ok: false,
      message: "Could not approve this look. Try again.",
    };
  }
}
