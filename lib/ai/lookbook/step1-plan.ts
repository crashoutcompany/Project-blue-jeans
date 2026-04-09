import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { GEMINI_STRUCTURE_MODEL } from "@/lib/ai/gemini-models";
import { STEP1_SYSTEM, step1UserPrompt } from "@/lib/ai/lookbook/prompts";
import { createLookbookSchema, type LookbookPlan } from "@/lib/ai/lookbook/schemas";

export type RunOutfitPlanStepParams = {
  lookCount: number;
  climate: string;
  context: string;
  narrative: string;
  catalogText: string;
  weekly?: boolean;
};

export async function runOutfitPlanStep(
  params: RunOutfitPlanStepParams,
): Promise<LookbookPlan> {
  const schema = createLookbookSchema(params.lookCount);
  const { object } = await generateObject({
    model: google(GEMINI_STRUCTURE_MODEL),
    system: STEP1_SYSTEM,
    schema,
    prompt: step1UserPrompt({
      lookCount: params.lookCount,
      climate: params.climate,
      context: params.context,
      narrative: params.narrative,
      catalogText: params.catalogText,
      weekly: params.weekly,
    }),
  });
  return object;
}
