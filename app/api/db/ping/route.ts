import { connection, NextResponse } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { safeClientMessage } from "@/lib/server/safe-client-error";

/**
 * GET /api/db/ping — verifies Neon connectivity (`SELECT 1`).
 * Safe to call in dev after pasting DATABASE_URL into .env.local.
 */
export async function GET() {
  await connection();
  try {
    await auth.getSession();
  } catch (e) {
    console.error("[api/db/ping] getSession failed", e);
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: gate.status },
    );
  }

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
        message: safeClientMessage(
          "db/ping",
          e,
          "Database connection check failed.",
        ),
      },
      { status: 500 },
    );
  }
}
