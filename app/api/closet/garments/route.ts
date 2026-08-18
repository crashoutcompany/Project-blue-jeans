import { connection, NextResponse } from "next/server";
import { z } from "zod";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  revalidateAfterGarmentDelete,
  revalidateClosetGarmentSurfaces,
} from "@/lib/cache/revalidate-wearer-surfaces";
import { deleteGarment } from "@/lib/garments/delete-garment";
import { GARMENT_FIELD_LIMITS } from "@/lib/garments/field-limits";
import {
  persistUploadedGarmentItems,
  type CreateGarmentItemInput,
} from "@/lib/garments/persist-uploaded-garments";
import { garmentCategorySchema } from "@/lib/garments/types";
import { updateGarmentFields } from "@/lib/garments/update-garment";

/** Allow Gemini describe + optional url_context on PATCH. */
export const maxDuration = 60;

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

async function requireAdmittedUser(): Promise<
  | { ok: true; userId: string; membership: import("@/lib/auth/membership").MembershipPolicy }
  | { ok: false; response: NextResponse }
> {
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false as const, message: gate.message },
        { status: gate.status },
      ),
    };
  }
  return { ok: true, userId: gate.userId, membership: gate.membership };
}

const createItemSchema = z.object({
  mediaAssetId: z.string().uuid(),
  name: z.string(),
  category: garmentCategorySchema,
  color: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
});

const createBodySchema = z.object({
  items: z.array(createItemSchema).min(1),
});

const patchBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().max(GARMENT_FIELD_LIMITS.name),
  category: garmentCategorySchema,
  color: z.string().max(GARMENT_FIELD_LIMITS.color),
  notes: z.string().max(GARMENT_FIELD_LIMITS.notes),
  description: z.string().max(GARMENT_FIELD_LIMITS.description),
  regenerateNameWithAi: z.boolean().optional(),
  regenerateDescriptionWithAi: z.boolean().optional(),
});

const deleteBodySchema = z.object({
  id: z.string().min(1),
});

/**
 * Persists UploadThing-backed closet rows. Uses JSON instead of a server action
 * so saves still work when Neon Auth refreshes the session concurrently with
 * UploadThing (which otherwise breaks `fetchServerAction`).
 */
export async function POST(request: Request) {
  await connection();
  const gate = await requireAdmittedUser();
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = createBodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const items: CreateGarmentItemInput[] = parsed.data.items;
  const result = await persistUploadedGarmentItems(
    gate.userId,
    items,
    gate.membership,
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  revalidateClosetGarmentSurfaces(gate.userId);
  return NextResponse.json(result);
}

/**
 * Update one closet garment. Same JSON rationale as POST — avoid Neon Auth
 * races that break server-action `fetchServerAction`.
 */
export async function PATCH(request: Request) {
  await connection();
  const gate = await requireAdmittedUser();
  if (!gate.ok) return gate.response;

  const bodyRead = await readJsonBody(request);
  if (!bodyRead.ok) return bodyRead.response;

  const parsed = patchBodySchema.safeParse(bodyRead.json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const result = await updateGarmentFields(
    gate.userId,
    {
      id: body.id,
      name: body.name,
      category: body.category,
      color: body.color,
      notes: body.notes,
      description: body.description,
      regenerateNameWithAi: body.regenerateNameWithAi,
      regenerateDescriptionWithAi: body.regenerateDescriptionWithAi,
    },
    gate.membership,
  );
  if (!result.ok) {
    const status = result.message === "Garment not found." ? 404 : 422;
    return NextResponse.json(result, { status });
  }

  revalidateClosetGarmentSurfaces(gate.userId);
  return NextResponse.json(result);
}

/**
 * Remove one closet garment and its UploadThing file. Same JSON rationale as
 * POST/PATCH — avoid Neon Auth races that break server-action fetch.
 */
export async function DELETE(request: Request) {
  await connection();
  const gate = await requireAdmittedUser();
  if (!gate.ok) return gate.response;

  const bodyRead = await readJsonBody(request);
  if (!bodyRead.ok) return bodyRead.response;

  const parsed = deleteBodySchema.safeParse(bodyRead.json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await deleteGarment(gate.userId, parsed.data.id.trim());
  if (!result.ok) {
    const status = result.message === "Garment not found." ? 404 : 422;
    return NextResponse.json(result, { status });
  }

  try {
    revalidateAfterGarmentDelete(gate.userId);
  } catch (e) {
    console.error("[api/closet/garments] delete revalidate failed", e);
  }
  return NextResponse.json(result);
}
