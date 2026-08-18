import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { clearWearerPhoto, saveWearerPhoto } from "@/lib/wearer/profile";

const putSchema = z.object({
  mediaAssetId: z.string().uuid(),
});

export async function PUT(request: Request) {
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: gate.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid photo payload." },
      { status: 400 },
    );
  }

  const result = await saveWearerPhoto({
    userId: gate.userId,
    mediaAssetId: parsed.data.mediaAssetId,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: gate.status },
    );
  }

  const result = await clearWearerPhoto(gate.userId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}
