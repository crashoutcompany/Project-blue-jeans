import { connection, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import { revalidateOutfitSurfaces } from "@/lib/cache/revalidate-wearer-surfaces";
import {
  approveGeneratorPayloadSchema,
  executeApproveGeneratorOutfit,
} from "@/lib/outfits/persist-generator-outfit";

/**
 * JSON save for generator “Approve” — avoids server actions + Neon Auth refresh races
 * (`fetchServerAction` “unexpected response”).
 */
export async function POST(request: Request) {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) {
    return NextResponse.json(
      { ok: false as const, message: "Sign in to continue." },
      { status: 401 },
    );
  }
  if (!isAdminUser(data.user)) {
    return NextResponse.json(
      { ok: false as const, message: "Admin access is required." },
      { status: 403 },
    );
  }
  const userId = typeof data.user.id === "string" ? data.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { ok: false as const, message: "Session is missing a user id." },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = approveGeneratorPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid outfit data." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await executeApproveGeneratorOutfit(userId, parsed.data);
  } catch (e) {
    console.error("[api/outfits/approve-generator] save failed", e);
    return NextResponse.json(
      { ok: false as const, message: "Could not save this outfit." },
      { status: 500 },
    );
  }
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  try {
    revalidateOutfitSurfaces(userId);
  } catch (e) {
    console.error("[api/outfits/approve-generator] revalidate failed", e);
  }
  return NextResponse.json(result);
}
