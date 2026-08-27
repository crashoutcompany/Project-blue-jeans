import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  clearWearerPhoto,
  saveWearerPhoto,
  type WearerPhotoResult,
} from "@/lib/wearer/profile";

const putSchema = z.object({
  mediaAssetId: z.string().uuid(),
});

function failureResponse(result: Extract<WearerPhotoResult, { ok: false }>) {
  return NextResponse.json(
    { ok: false as const, message: result.message },
    { status: result.reason === "not_found" ? 404 : 500 },
  );
}

export async function PUT(request: Request) {
  await connection();
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
    membership: gate.membership,
  });
  if (!result.ok) {
    return failureResponse(result);
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: gate.status },
    );
  }

  const result = await clearWearerPhoto(gate.userId, gate.membership);
  if (!result.ok) {
    return failureResponse(result);
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}
