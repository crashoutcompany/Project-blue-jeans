import { revalidatePath, revalidateTag } from "next/cache";
import { connection, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import { closetGarmentsTag } from "@/lib/garments/closet-garments-cache-tag";
import {
  persistUploadedGarmentItems,
  type CreateGarmentItemInput,
} from "@/lib/garments/persist-uploaded-garments";
import { isGarmentCategoryDb } from "@/lib/garments/types";

function revalidateClosetAfterWrite(userId: string) {
  try {
    revalidateTag(closetGarmentsTag(userId), "max");
    // Tag alone can leave the closet PPR shell stale; path revalidation refreshes the segment.
    revalidatePath("/closet", "page");
    revalidatePath("/", "page");
  } catch (e) {
    console.error("[api/closet/garments] revalidate failed", e);
  }
}

function parseBody(json: unknown): CreateGarmentItemInput[] | null {
  if (typeof json !== "object" || json === null) return null;
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const out: CreateGarmentItemInput[] = [];
  for (const row of items) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    if (typeof r.url !== "string" || typeof r.key !== "string") return null;
    if (typeof r.name !== "string") return null;
    if (typeof r.category !== "string" || !isGarmentCategoryDb(r.category)) {
      return null;
    }
    out.push({
      url: r.url,
      key: r.key,
      name: r.name,
      category: r.category,
      color: typeof r.color === "string" ? r.color : undefined,
      notes: typeof r.notes === "string" ? r.notes : undefined,
      description:
        typeof r.description === "string" ? r.description : undefined,
    });
  }
  return out;
}

/**
 * Persists UploadThing-backed closet rows. Uses JSON instead of a server action
 * so saves still work when Neon Auth refreshes the session concurrently with
 * UploadThing (which otherwise breaks `fetchServerAction`).
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
      {
        ok: false as const,
        message: "Admin access is required.",
      },
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

  const items = parseBody(json);
  if (!items) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await persistUploadedGarmentItems(userId, items);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  revalidateClosetAfterWrite(userId);
  return NextResponse.json(result);
}
