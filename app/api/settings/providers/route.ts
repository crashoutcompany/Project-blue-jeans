import { connection, NextResponse } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { getGoogleAiStudioSettings } from "@/lib/credentials/google-ai-studio";

export async function GET() {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  const googleAiStudio = await getGoogleAiStudioSettings(
    gate.userId,
    gate.membership,
  );

  return NextResponse.json({
    ok: true as const,
    googleAiStudio,
  });
}
