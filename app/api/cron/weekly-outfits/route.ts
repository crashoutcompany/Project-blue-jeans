/**
 * Vercel Cron: generate weekly Fits + hero images for every Wearer with garments.
 *
 * Environment:
 * - `CRON_SECRET` — Vercel sends `Authorization: Bearer <CRON_SECRET>`.
 * - Gemini (AI Studio): `GOOGLE_GENERATIVE_AI_API_KEY` (see docs/gemini-ai-studio-env.md).
 * - `DATABASE_URL` — Neon.
 *
 * @see https://vercel.com/docs/cron-jobs
 */
import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";
import {
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const weekStart = sundayWeekStartIso(productTodayIso());
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured." },
      { status: 500 },
    );
  }

  let userIds: string[] = [];
  try {
    const rows = (await sql`
      SELECT DISTINCT user_id
      FROM garments
      WHERE user_id IS NOT NULL AND user_id <> ''
    `) as { user_id: string }[];
    userIds = rows.map((r) => r.user_id);
  } catch (e) {
    console.error("[cron/weekly-outfits] list users failed", e);
    return NextResponse.json(
      { ok: false, error: "Could not list Wearer accounts." },
      { status: 500 },
    );
  }

  const results: Array<{
    userId: string;
    ok: boolean;
    skipped?: boolean;
    planId?: string;
    error?: string;
  }> = [];

  const startTime = Date.now();
  const maxRuntimeMs =
    typeof maxDuration === "number" ? maxDuration * 1000 : 280_000;

  for (const userId of userIds) {
    if (Date.now() - startTime >= maxRuntimeMs) {
      break;
    }

    try {
      const result = await runWeeklyOutfitsJob({
        userId,
        weekStart,
        climate: "Temperate",
        context: "Everyday week",
        narrative: "",
      });
      if (!result.ok) {
        results.push({
          userId,
          ok: false,
          planId: result.planId,
          error: result.error,
        });
        continue;
      }
      results.push({
        userId,
        ok: true,
        skipped: result.skipped,
        planId: result.planId,
      });
    } catch (e) {
      console.error("[cron/weekly-outfits] job failed", { userId, error: e });
      results.push({ userId, ok: false, error: "Unexpected error" });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        weekStart,
        results,
        error: `${failed.length} account(s) failed`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    weekStart,
    accounts: results.length,
    results,
    message: "Weekly outfits generated",
  });
}
