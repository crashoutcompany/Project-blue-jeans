import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { isPlatformFundedOwner } from "@/lib/auth/membership";
import {
  revokeGoogleAiStudioByok,
  saveGoogleAiStudioByok,
} from "@/lib/credentials/google-ai-studio";

const putSchema = z.object({
  apiKey: z.string().min(1).max(512),
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
      { ok: false as const, message: "Enter a Google AI Studio API key." },
      { status: 400 },
    );
  }

  try {
    const result = await saveGoogleAiStudioByok(
      gate.userId,
      gate.membership,
      parsed.data.apiKey,
    );
    if (!result.ok) {
      const status =
        isPlatformFundedOwner(gate.membership) ? 409 : 422;
      return NextResponse.json(result, { status });
    }

    revalidatePath("/settings");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        message: "Could not save that key. Try again in a moment.",
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
    const result = await revokeGoogleAiStudioByok(
      gate.userId,
      gate.membership,
    );
    if (!result.ok) {
      const status =
        isPlatformFundedOwner(gate.membership) ? 409 : 422;
      return NextResponse.json(result, { status });
    }

    revalidatePath("/settings");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        message: "Could not disconnect Google AI Studio. Try again.",
      },
      { status: 500 },
    );
  }
}
