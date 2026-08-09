import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminForServerAction } from "@/lib/auth/admin";
import {
  clearWearerPhoto,
  saveWearerPhoto,
} from "@/lib/wearer/profile";

const putSchema = z.object({
  url: z.string().url().max(2048),
  key: z.string().max(512).optional().nullable(),
});

export async function PUT(request: Request) {
  const gate = await assertAdminForServerAction();
  if (!gate.ok) {
    return NextResponse.json({ ok: false, message: gate.message }, { status: 401 });
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
    imageUrl: parsed.data.url,
    uploadthingKey: parsed.data.key,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const gate = await assertAdminForServerAction();
  if (!gate.ok) {
    return NextResponse.json({ ok: false, message: gate.message }, { status: 401 });
  }

  const result = await clearWearerPhoto(gate.userId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}
