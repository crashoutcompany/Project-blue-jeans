import { connection, NextResponse } from "next/server";

import { suggestGarmentCategory } from "@/lib/ai/garments/suggest-category";
import { MAX_AI_IMAGE_BYTES } from "@/lib/ai/fetch-image-part";
import { assertAdmittedSession } from "@/lib/auth/admitted";
import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { logServerError } from "@/lib/server/safe-client-error";

export async function POST(request: Request) {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false as const, message: gate.message },
      { status: gate.status },
    );
  }

  const gemini = await resolveGeminiApiKey(gate.userId, gate.membership);
  if (!gemini.ok) {
    return NextResponse.json(
      { ok: false as const, message: gemini.message },
      { status: 422 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false as const, message: "Invalid upload." },
      { status: 400 },
    );
  }

  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json(
      { ok: false as const, message: "An image is required." },
      { status: 400 },
    );
  }
  if (image.size > MAX_AI_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false as const, message: "That image is too large." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = image.type.startsWith("image/") ? image.type : "image/jpeg";

  try {
    const category = await suggestGarmentCategory({
      apiKey: gemini.apiKey,
      image: bytes,
      mediaType,
    });
    return NextResponse.json({ ok: true as const, category });
  } catch (error) {
    logServerError("POST /api/closet/suggest-category", error);
    return NextResponse.json(
      { ok: false as const, message: "Could not suggest a category." },
      { status: 500 },
    );
  }
}
