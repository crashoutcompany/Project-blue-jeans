import { connection, NextResponse } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { getOwnedMediaAsset } from "@/lib/media/assets";
import { MEDIA_SIGNED_URL_MAX_SECONDS } from "@/lib/media/display";
import { resolveUploadThingTokenForConnection } from "@/lib/credentials/resolve";
import { generatePrivateMediaUrl } from "@/lib/media/uploadthing-api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid media." },
      { status: 400 },
    );
  }

  const asset = await getOwnedMediaAsset(gate.userId, id);
  if (!asset) {
    return NextResponse.json(
      { ok: false as const, message: "Media not found." },
      { status: 404 },
    );
  }

  const resolved = await resolveUploadThingTokenForConnection(
    gate.userId,
    asset.connectionId,
    gate.membership,
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false as const, message: resolved.message },
      { status: 409 },
    );
  }

  try {
    const url = await generatePrivateMediaUrl(
      resolved.token,
      asset.providerFileKey,
      MEDIA_SIGNED_URL_MAX_SECONDS,
    );
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false as const, message: "Could not load that photo." },
      { status: 502 },
    );
  }
}
