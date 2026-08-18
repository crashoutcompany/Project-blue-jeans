import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  createWearerInvite,
  listPendingInvites,
} from "@/lib/auth/invites";

const postSchema = z.object({
  email: z.string().trim().email().max(320),
});

export async function GET() {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }
  if (gate.membership.accessRole !== "owner") {
    return NextResponse.json(
      { ok: false as const, message: "Only the owner can invite Wearers." },
      { status: 403 },
    );
  }

  const invites = await listPendingInvites(gate.userId);
  return NextResponse.json({ ok: true as const, invites });
}

export async function POST(request: Request) {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  if (gate.membership.accessRole !== "owner") {
    return NextResponse.json(
      { ok: false as const, message: "Only the owner can invite Wearers." },
      { status: 403 },
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

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, message: "Enter an email address." },
      { status: 400 },
    );
  }

  try {
    const result = await createWearerInvite({
      owner: gate.membership,
      email: parsed.data.email,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    revalidatePath("/settings");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        message: "Could not create that invite. Try again.",
      },
      { status: 500 },
    );
  }
}
