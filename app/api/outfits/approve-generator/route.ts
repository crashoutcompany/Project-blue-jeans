import { revalidatePath, revalidateTag } from "next/cache";
import { connection, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import {
  approveGeneratorPayloadSchema,
  executeApproveGeneratorOutfit,
} from "@/lib/outfits/persist-generator-outfit";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";

function revalidateAfterOutfitWrite(userId: string) {
  try {
    revalidateTag(closetSavedOutfitsTag(userId), "max");
    revalidateTag(calendarMonthTag(userId), "max");
    revalidatePath("/calendar");
    revalidatePath("/closet");
    revalidatePath("/");
  } catch (e) {
    console.error("[api/outfits/approve-generator] revalidate failed", e);
  }
}

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
  const userId =
    typeof data.user.id === "string" ? data.user.id.trim() : "";
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

  const result = await executeApproveGeneratorOutfit(userId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  revalidateAfterOutfitWrite(userId);
  return NextResponse.json(result);
}
