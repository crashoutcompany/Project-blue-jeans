import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { saveWearerLocation } from "@/lib/wearer/preferences";

const putSchema = z.object({
  location: z.string().max(120),
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
      { ok: false as const, message: "Enter a city name." },
      { status: 400 },
    );
  }

  const result = await saveWearerLocation(gate.userId, parsed.data.location);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true as const });
}
