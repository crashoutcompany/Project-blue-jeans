import { connection, NextResponse } from "next/server";

import { getSql } from "@/lib/db";

/**
 * GET /api/db/ping — verifies Neon connectivity (`SELECT 1`).
 * Safe to call in dev after pasting DATABASE_URL into .env.local.
 */
export async function GET() {
  await connection();
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { ok: false, message: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }

  try {
    await sql`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Database query failed",
      },
      { status: 500 },
    );
  }
}
