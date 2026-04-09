/**
 * Vercel Cron entry: starts the durable weekly outfit workflow (step 1 + Batch images).
 *
 * Environment:
 * - `CRON_SECRET` — Vercel sets `Authorization: Bearer <CRON_SECRET>` on cron invocations;
 *   this route rejects requests without a matching bearer token.
 * - `GOOGLE_GENERATIVE_AI_API_KEY` — step 1 (AI SDK) + Batch REST use the same Gemini key.
 * - `DATABASE_URL` — Neon; required for plan persistence inside workflow steps.
 *
 * @see https://vercel.com/docs/cron-jobs
 * @see https://vercel.com/docs/workflow
 */
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { weeklyOutfitWorkflow } from "@/workflows/weekly-outfit";

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

  await start(weeklyOutfitWorkflow, [
    {
      weekStart,
      climate: "Temperate",
      context: "Everyday week",
      narrative: "",
    },
  ]);

  return NextResponse.json({
    ok: true,
    message: "Weekly outfit workflow started",
    weekStart,
  });
}
