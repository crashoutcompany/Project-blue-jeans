import { NextResponse } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  generateLookbook,
  type GenerateLookbookInput,
} from "@/lib/lookbook/generate-lookbook";
import { safeClientMessage } from "@/lib/server/safe-client-error";

/** Plan + up to 3 parallel hero images. */
export const maxDuration = 120;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function POST(request: Request) {
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

  if (typeof json !== "object" || json === null) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const body = json as Record<string, unknown>;
  if (typeof body.narrative !== "string") {
    return NextResponse.json(
      { ok: false as const, message: "Missing narrative." },
      { status: 400 },
    );
  }

  const input: GenerateLookbookInput = {
    userId: gate.userId,
    membership: gate.membership,
    narrative: body.narrative,
  };

  if (typeof body.climate === "string") input.climate = body.climate;
  if (typeof body.context === "string") input.context = body.context;
  if (body.includedGarmentIds !== undefined) {
    if (!isStringArray(body.includedGarmentIds)) {
      return NextResponse.json(
        {
          ok: false as const,
          message: "includedGarmentIds must be a string array.",
        },
        { status: 400 },
      );
    }
    input.includedGarmentIds = body.includedGarmentIds;
  }
  if (typeof body.lookCount === "number" && Number.isFinite(body.lookCount)) {
    input.lookCount = body.lookCount;
  }
  if (body.weekly === true) input.weekly = true;
  if (body.skipHeroImage === true) input.skipHeroImage = true;

  try {
    const result = await generateLookbook(input);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false as const,
      message: safeClientMessage(
        "POST /api/generate-lookbook",
        error,
        "We could not generate your lookbook. Try again in a moment.",
      ),
    });
  }
}
