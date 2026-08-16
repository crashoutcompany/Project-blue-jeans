import { revalidatePath, revalidateTag } from "next/cache";
import { connection, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import { closetGarmentsTag } from "@/lib/garments/closet-garments-cache-tag";
import { deleteGarment } from "@/lib/garments/delete-garment";
import {
  persistUploadedGarmentItems,
  type CreateGarmentItemInput,
} from "@/lib/garments/persist-uploaded-garments";
import { updateGarmentFields, GARMENT_FIELD_LIMITS } from "@/lib/garments/update-garment";
import { isGarmentCategoryDb } from "@/lib/garments/types";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";

/** Allow Gemini describe + optional url_context on PATCH. */
export const maxDuration = 60;

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

async function readJsonBody(
  request: Request,
): Promise<
  { ok: true; json: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, json: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false as const, message: "Invalid JSON body." },
        { status: 400 },
      ),
    };
  }
}

async function requireAdminUserId(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const { data } = await auth.getSession();
  if (!data?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false as const, message: "Sign in to continue." },
        { status: 401 },
      ),
    };
  }
  if (!isAdminUser(data.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false as const,
          message: "Admin access is required.",
        },
        { status: 403 },
      ),
    };
  }
  const userId = typeof data.user.id === "string" ? data.user.id.trim() : "";
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false as const, message: "Session is missing a user id." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, userId };
}

function parseCreateBody(json: unknown): CreateGarmentItemInput[] | null {
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

type PatchBody = {
  id: string;
  name: string;
  category: CreateGarmentItemInput["category"];
  color: string;
  notes: string;
  description: string;
  regenerateNameWithAi?: boolean;
  regenerateDescriptionWithAi?: boolean;
};

function parseDeleteBody(json: unknown): { id: string } | null {
  if (typeof json !== "object" || json === null) return null;
  const id = (json as { id?: unknown }).id;
  if (typeof id !== "string" || !id.trim()) return null;
  return { id: id.trim() };
}

function parsePatchBody(json: unknown): PatchBody | null {
  if (typeof json !== "object" || json === null) return null;
  const r = json as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  if (typeof r.name !== "string") return null;
  if (typeof r.category !== "string" || !isGarmentCategoryDb(r.category)) {
    return null;
  }
  if (typeof r.color !== "string") return null;
  if (typeof r.notes !== "string") return null;
  if (typeof r.description !== "string") return null;
  if (r.name.length > GARMENT_FIELD_LIMITS.name) return null;
  if (r.color.length > GARMENT_FIELD_LIMITS.color) return null;
  if (r.notes.length > GARMENT_FIELD_LIMITS.notes) return null;
  if (r.description.length > GARMENT_FIELD_LIMITS.description) return null;
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    color: r.color,
    notes: r.notes,
    description: r.description,
    regenerateNameWithAi: r.regenerateNameWithAi === true,
    regenerateDescriptionWithAi: r.regenerateDescriptionWithAi === true,
  };
}

/**
 * Persists UploadThing-backed closet rows. Uses JSON instead of a server action
 * so saves still work when Neon Auth refreshes the session concurrently with
 * UploadThing (which otherwise breaks `fetchServerAction`).
 */
export async function POST(request: Request) {
  await connection();
  const gate = await requireAdminUserId();
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const items = parseCreateBody(body.json);
  if (!items) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await persistUploadedGarmentItems(gate.userId, items);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  revalidateClosetAfterWrite(gate.userId);
  return NextResponse.json(result);
}

/**
 * Update one closet garment. Same JSON rationale as POST — avoid Neon Auth
 * races that break server-action `fetchServerAction`.
 */
export async function PATCH(request: Request) {
  await connection();
  const gate = await requireAdminUserId();
  if (!gate.ok) return gate.response;

  const bodyRead = await readJsonBody(request);
  if (!bodyRead.ok) return bodyRead.response;

  const body = parsePatchBody(bodyRead.json);
  if (!body) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await updateGarmentFields(gate.userId, {
    id: body.id,
    name: body.name,
    category: body.category,
    color: body.color,
    notes: body.notes,
    description: body.description,
    regenerateNameWithAi: body.regenerateNameWithAi,
    regenerateDescriptionWithAi: body.regenerateDescriptionWithAi,
  });
  if (!result.ok) {
    const status = result.message === "Garment not found." ? 404 : 422;
    return NextResponse.json(result, { status });
  }

  revalidateClosetAfterWrite(gate.userId);
  return NextResponse.json(result);
}

/**
 * Remove one closet garment and its UploadThing file. Same JSON rationale as
 * POST/PATCH — avoid Neon Auth races that break server-action fetch.
 */
export async function DELETE(request: Request) {
  await connection();
  const gate = await requireAdminUserId();
  if (!gate.ok) return gate.response;

  const bodyRead = await readJsonBody(request);
  if (!bodyRead.ok) return bodyRead.response;

  const body = parseDeleteBody(bodyRead.json);
  if (!body) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await deleteGarment(gate.userId, body.id);
  if (!result.ok) {
    const status = result.message === "Garment not found." ? 404 : 422;
    return NextResponse.json(result, { status });
  }

  try {
    revalidateTag(closetSavedOutfitsTag(gate.userId), "max");
    revalidateTag(calendarMonthTag(gate.userId), "max");
    revalidatePath("/calendar", "page");
  } catch (e) {
    console.error("[api/closet/garments] delete revalidate failed", e);
  }
  revalidateClosetAfterWrite(gate.userId);
  return NextResponse.json(result);
}
