import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { MAX_REPEAT_WINDOW_DAYS } from "@/lib/outfits/repeat-guard";
import { saveRepeatWindowDays } from "@/lib/wearer/preferences";

const putSchema = z.object({
  days: z.number().int().min(0).max(MAX_REPEAT_WINDOW_DAYS),
});

export async function PUT(request: Request) {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        message: `Enter a whole number of days from 0 to ${MAX_REPEAT_WINDOW_DAYS}.`,
      },
      { status: 400 },
    );
  }

  const result = await saveRepeatWindowDays(gate.userId, parsed.data.days);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  revalidatePath("/settings");
  return NextResponse.json({ ok: true as const });
}
