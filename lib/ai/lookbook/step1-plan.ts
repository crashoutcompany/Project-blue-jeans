import {
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  stepCountIs,
} from "ai";

import { geminiModel } from "@/lib/ai/gemini-provider";
import { GEMINI_STRUCTURE_MODEL } from "@/lib/ai/gemini-models";
import { OutfitPlanError } from "@/lib/ai/lookbook/plan-error";
import { STEP1_SYSTEM, step1UserPrompt, type AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import {
  createLookbookModelSchema,
  normalizeLookbookPlan,
  type LookbookPlan,
} from "@/lib/ai/lookbook/schemas";
import { outfitPlanTools } from "@/lib/ai/weather/get-weather-tool";

/** Weather tool round-trips plus the final JSON answer. */
const MAX_STEPS = 5;

export type RunOutfitPlanStepParams = {
  apiKey: string;
  lookCount: number;
  climate: string;
  context: string;
  narrative: string;
  catalogText: string;
  location: string;
  weekly?: boolean;
  weeklyWeekday?: string;
  alreadyPlanned?: AlreadyPlannedLook[];
  mustWearIds?: string[];
  mustWearNames?: string[];
};

/** Pull a JSON object out of a reply that may be wrapped in prose or a code fence. */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * Recover a plan from the raw text of a reply the AI SDK rejected. Returns
 * null when the text is not a usable plan.
 */
export function salvagePlanFromText(
  text: string | undefined,
  lookCount: number,
): LookbookPlan | null {
  if (!text) return null;
  const parsed = createLookbookModelSchema(lookCount).safeParse(
    extractJsonObject(text),
  );
  return parsed.success ? normalizeLookbookPlan(parsed.data, lookCount) : null;
}

export async function runOutfitPlanStep(
  params: RunOutfitPlanStepParams,
): Promise<LookbookPlan> {
  const { lookCount } = params;
  let output;
  try {
    const result = await generateText({
      model: geminiModel(GEMINI_STRUCTURE_MODEL, params.apiKey),
      system: STEP1_SYSTEM,
      tools: outfitPlanTools,
      output: Output.object({
        schema: createLookbookModelSchema(lookCount),
        name: "outfit_plan",
      }),
      stopWhen: stepCountIs(MAX_STEPS),
      // The last step must answer; a tool call there leaves no output at all.
      prepareStep: ({ stepNumber }) =>
        stepNumber >= MAX_STEPS - 1 ? { toolChoice: "none" } : undefined,
      prompt: step1UserPrompt({
        lookCount,
        climate: params.climate,
        context: params.context,
        narrative: params.narrative,
        catalogText: params.catalogText,
        location: params.location,
        weekly: params.weekly,
        weeklyWeekday: params.weeklyWeekday,
        alreadyPlanned: params.alreadyPlanned,
        mustWearIds: params.mustWearIds,
        mustWearNames: params.mustWearNames,
      }),
    });
    output = result.output;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      const salvaged = salvagePlanFromText(e.text, lookCount);
      if (salvaged) return salvaged;
      throw new OutfitPlanError(
        "no-object",
        `Outfit plan did not match the schema (finishReason=${e.finishReason ?? "unknown"}): ${e.cause instanceof Error ? e.cause.message : e.message}`,
        { cause: e },
      );
    }
    if (NoOutputGeneratedError.isInstance(e)) {
      throw new OutfitPlanError(
        "no-object",
        "Outfit plan returned no structured output.",
        { cause: e },
      );
    }
    throw e;
  }

  const plan = normalizeLookbookPlan(output, lookCount);
  if (!plan) {
    throw new OutfitPlanError(
      "no-object",
      `Outfit plan returned ${output.looks.length} looks; expected ${lookCount}.`,
    );
  }
  return plan;
}
