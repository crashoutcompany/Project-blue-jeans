import { NextResponse } from "next/server";

import {
  adminRequiredJsonResponse,
  sessionAllowsAdminApi,
} from "@/lib/auth/admin-api";
import { auth } from "@/lib/auth/server";
import {
  generateLookbook,
  type GenerateLookbookInput,
} from "@/lib/lookbook/generate-lookbook";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function POST(request: Request) {
  const { data } = await auth.getSession();
  if (!data?.user) {
    return NextResponse.json(
      { ok: false as const, message: "Sign in to generate looks." },
      { status: 401 },
    );
  }
  if (!sessionAllowsAdminApi(data.user)) {
    return adminRequiredJsonResponse();
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

  const userId = typeof data.user.id === "string" ? data.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { ok: false as const, message: "Session is missing a user id." },
      { status: 401 },
    );
  }

  const input: GenerateLookbookInput = {
    userId,
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

  const result = await generateLookbook(input);
  return NextResponse.json(result);
}
