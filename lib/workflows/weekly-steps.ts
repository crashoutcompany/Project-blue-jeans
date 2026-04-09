import { FatalError } from "workflow";

import { generateLookbook } from "@/app/actions/generate-lookbook";
import { GEMINI_BATCH_IMAGE_MODEL } from "@/lib/ai/gemini-models";
import {
  batchGenerateContentCreate,
  extractInlinedImageDataUrls,
  getOperation,
} from "@/lib/google/gemini-batch-rest";
import { requireSql } from "@/lib/db";
import { buildBatchImageRequestForLook } from "@/lib/workflows/weekly-batch-request";
import type { WeeklyWorkflowInput } from "@/lib/workflows/types";

function requireGeminiKey(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) {
    throw new FatalError("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  return key;
}

export async function markWeeklyBatchFailedStep(
  planId: string,
  operationName: string,
  message: string,
): Promise<void> {
  "use step";

  const sql = requireSql();
  const msg = message.slice(0, 2000);
  await sql`
    UPDATE weekly_outfit_plans
    SET
      status = 'failed',
      error_message = ${msg},
      updated_at = now()
    WHERE id = ${planId}
  `;
  await sql`
    UPDATE google_batch_jobs
    SET
      state = 'JOB_STATE_FAILED',
      completed_at = now(),
      error_message = ${msg}
    WHERE google_batch_name = ${operationName}
  `;
}

export async function persistWeeklyPlanStep(
  input: WeeklyWorkflowInput,
): Promise<{ planId: string; skipped: boolean }> {
  "use step";

  const sql = requireSql();

  const existingRows = (await sql`
    SELECT id, status::text AS status
    FROM weekly_outfit_plans
    WHERE week_start = ${input.weekStart}::date
    LIMIT 1
  `) as { id: string; status: string }[];
  const row = existingRows[0];
  if (row?.status === "completed") {
    return { planId: row.id, skipped: true };
  }

  const gen = await generateLookbook({
    climate: input.climate,
    context: input.context,
    narrative: input.narrative,
    lookCount: 7,
    weekly: true,
    skipHeroImage: true,
  });

  if (!gen.ok) {
    throw new FatalError(gen.message);
  }

  if (gen.looks.length !== 7) {
    throw new FatalError(`Expected 7 looks, got ${gen.looks.length}`);
  }

  let planId: string;

  if (row) {
    planId = row.id;
    await sql`DELETE FROM weekly_plan_looks WHERE plan_id = ${planId}`;
    await sql`
      UPDATE weekly_outfit_plans
      SET
        step1_raw = ${JSON.stringify(gen)}::jsonb,
        status = 'draft',
        error_message = NULL,
        updated_at = now()
      WHERE id = ${planId}
    `;
  } else {
    const insertedRows = (await sql`
      INSERT INTO weekly_outfit_plans (week_start, step1_raw, status)
      VALUES (${input.weekStart}::date, ${JSON.stringify(gen)}::jsonb, 'draft')
      RETURNING id
    `) as { id: string }[];
    planId = insertedRows[0]!.id;
  }

  for (let i = 0; i < gen.looks.length; i++) {
    const look = gen.looks[i]!;
    await sql`
      INSERT INTO weekly_plan_looks (
        plan_id,
        sort_order,
        title,
        description,
        tags,
        garment_ids
      )
      VALUES (
        ${planId},
        ${i},
        ${look.title},
        ${look.description},
        ${JSON.stringify(look.tags)}::jsonb,
        ${look.garmentIds ?? []}
      )
    `;
  }

  return { planId, skipped: false };
}

export async function submitWeeklyBatchStep(
  input: WeeklyWorkflowInput,
  planId: string,
): Promise<{ operationName: string }> {
  "use step";

  const sql = requireSql();
  const apiKey = requireGeminiKey();

  const looks = (await sql`
    SELECT sort_order, title, description, garment_ids
    FROM weekly_plan_looks
    WHERE plan_id = ${planId}
    ORDER BY sort_order ASC
  `) as {
    sort_order: number;
    title: string;
    description: string;
    garment_ids: string[] | null;
  }[];

  if (looks.length !== 7) {
    throw new FatalError(`Plan ${planId} must have 7 looks before batch submit.`);
  }

  const inlinedRequests: { request: Record<string, unknown> }[] = [];

  for (const l of looks) {
    const ids = l.garment_ids ?? [];
    if (ids.length === 0) {
      throw new FatalError(
        `Look sort_order=${l.sort_order} has no garment_ids; cannot build batch request.`,
      );
    }
    const request = await buildBatchImageRequestForLook({
      title: l.title,
      description: l.description,
      garmentIds: ids,
      climate: input.climate,
      context: input.context,
      narrative: input.narrative,
    });
    inlinedRequests.push({ request });
  }

  const displayName = `weekly-outfits-${planId.slice(0, 8)}-${Date.now()}`;
  const op = await batchGenerateContentCreate(
    apiKey,
    GEMINI_BATCH_IMAGE_MODEL,
    displayName,
    inlinedRequests,
  );

  if (!op.name) {
    throw new FatalError("Batch create returned no operation name.");
  }

  await sql`DELETE FROM google_batch_jobs WHERE plan_id = ${planId}`;

  await sql`
    INSERT INTO google_batch_jobs (plan_id, google_batch_name, state)
    VALUES (${planId}, ${op.name}, 'JOB_STATE_PENDING')
  `;

  await sql`
    UPDATE weekly_outfit_plans
    SET status = 'batch_submitted', updated_at = now()
    WHERE id = ${planId}
  `;

  return { operationName: op.name };
}

export async function pollBatchOnceStep(operationName: string): Promise<{
  done: boolean;
  success: boolean;
  imageUrls: (string | null)[];
  errorText?: string;
}> {
  "use step";

  const apiKey = requireGeminiKey();
  const op = await getOperation(apiKey, operationName);

  if (!op.done) {
    return { done: false, success: false, imageUrls: [] };
  }

  if (op.error) {
    return {
      done: true,
      success: false,
      imageUrls: [],
      errorText: JSON.stringify(op.error).slice(0, 2000),
    };
  }

  const urls = extractInlinedImageDataUrls(op);
  const anyImage = urls.some((u) => u != null);
  return { done: true, success: anyImage, imageUrls: urls };
}

export async function finalizeWeeklyBatchStep(
  planId: string,
  operationName: string,
  imageUrls: (string | null)[],
): Promise<void> {
  "use step";

  const sql = requireSql();

  if (imageUrls.length !== 7) {
    await sql`
      UPDATE weekly_outfit_plans
      SET
        status = 'failed',
        error_message = ${`Batch returned ${imageUrls.length} image slots, expected 7`},
        updated_at = now()
      WHERE id = ${planId}
    `;
    await sql`
      UPDATE google_batch_jobs
      SET
        state = 'JOB_STATE_FAILED',
        completed_at = now(),
        error_message = 'Unexpected response shape or image count'
      WHERE google_batch_name = ${operationName}
    `;
    throw new FatalError("Weekly batch finalize: wrong image count.");
  }

  for (let i = 0; i < 7; i++) {
    const url = imageUrls[i] ?? null;
    await sql`
      UPDATE weekly_plan_looks
      SET hero_image_url = ${url}
      WHERE plan_id = ${planId} AND sort_order = ${i}
    `;
  }

  await sql`
    UPDATE weekly_outfit_plans
    SET status = 'completed', updated_at = now(), error_message = NULL
    WHERE id = ${planId}
  `;

  await sql`
    UPDATE google_batch_jobs
    SET
      state = 'JOB_STATE_SUCCEEDED',
      completed_at = now(),
      error_message = NULL
    WHERE google_batch_name = ${operationName}
  `;
}
