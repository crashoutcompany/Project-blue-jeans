import { connection, NextResponse } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { getGoogleAiStudioSettings } from "@/lib/credentials/google-ai-studio";
import { getUploadThingSettings } from "@/lib/credentials/uploadthing";
import { sealLegacyUploadThingMedia } from "@/lib/media/seal-legacy";

export async function GET() {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  const [googleAiStudio, uploadthing] = await Promise.all([
    getGoogleAiStudioSettings(gate.userId, gate.membership),
    getUploadThingSettings(gate.userId, gate.membership),
  ]);

  void sealLegacyUploadThingMedia(gate.userId).catch(() => undefined);

  return NextResponse.json({
    ok: true as const,
    googleAiStudio,
    uploadthing,
  });
}
