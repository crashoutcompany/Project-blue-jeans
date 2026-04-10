/**
 * Vercel Cron: generate the weekly 7-look plan + hero images in one request.
 *
 * Environment:
 * - `CRON_SECRET` — Vercel sends `Authorization: Bearer <CRON_SECRET>`.
 * - Vertex AI: `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, auth (see docs/vertex-ai-env.md).
 * - `DATABASE_URL` — Neon.
 *
 * This route can run for several minutes (7 parallel plans + 7 parallel images). On Vercel Pro+, `maxDuration`
 * below raises the serverless limit; on Hobby, consider reducing work or using a queue later.
 *
 * @see https://vercel.com/docs/cron-jobs
 */
import { NextResponse } from "next/server";

import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

export const maxDuration = 300;

function mondayUtcIso(d = new Date()): string {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const mon = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff),
  );
  return mon.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = mondayUtcIso();

  const result = await runWeeklyOutfitsJob({
    weekStart,
    climate: "Temperate",
    context: "Everyday week",
    narrative: "",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        planId: result.planId,
        weekStart,
      },
      { status: 500 },
    );
  }

  if (result.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      planId: result.planId,
      weekStart,
      message: "Week already completed",
    });
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    planId: result.planId,
    weekStart,
    message: "Weekly outfits generated",
  });
}
