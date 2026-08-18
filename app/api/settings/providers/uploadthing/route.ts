import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  revokeUploadThingByok,
  saveUploadThingByok,
} from "@/lib/credentials/uploadthing";

const putSchema = z.object({
  token: z.string().min(1).max(4096),
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
      { ok: false as const, message: "Enter an UploadThing API token." },
      { status: 400 },
    );
  }

  try {
    const result = await saveUploadThingByok(
      gate.userId,
      gate.membership,
      parsed.data.token,
    );
    if (!result.ok) {
      const status =
        gate.membership.credentialSource === "platform_env" ? 409 : 422;
      return NextResponse.json(result, { status });
    }

    revalidatePath("/settings");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        message: "Could not save that token. Try again in a moment.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  try {
    const result = await revokeUploadThingByok(
      gate.userId,
      gate.membership,
    );
    if (!result.ok) {
      const status =
        gate.membership.credentialSource === "platform_env" ? 409 : 422;
      return NextResponse.json(result, { status });
    }

    revalidatePath("/settings");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        message: "Could not disconnect UploadThing. Try again.",
      },
      { status: 500 },
    );
  }
}
