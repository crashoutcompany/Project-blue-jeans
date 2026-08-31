import { generateText, Output, stepCountIs } from "ai";

import { geminiModel } from "@/lib/ai/gemini-provider";
import { GEMINI_STRUCTURE_MODEL } from "@/lib/ai/gemini-models";
import { STEP1_SYSTEM, step1UserPrompt, type AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import {
  createLookbookSchema,
  type LookbookPlan,
} from "@/lib/ai/lookbook/schemas";
import { outfitPlanTools } from "@/lib/ai/weather/get-weather-tool";

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
};

export async function runOutfitPlanStep(
  params: RunOutfitPlanStepParams,
): Promise<LookbookPlan> {
  const schema = createLookbookSchema(params.lookCount);
  const result = await generateText({
    model: geminiModel(GEMINI_STRUCTURE_MODEL, params.apiKey),
    system: STEP1_SYSTEM,
    tools: outfitPlanTools,
    output: Output.object({ schema }),
    stopWhen: stepCountIs(5),
    prompt: step1UserPrompt({
      lookCount: params.lookCount,
      climate: params.climate,
      context: params.context,
      narrative: params.narrative,
      catalogText: params.catalogText,
      location: params.location,
      weekly: params.weekly,
      weeklyWeekday: params.weeklyWeekday,
      alreadyPlanned: params.alreadyPlanned,
    }),
  });

  if (!result.output) {
    throw new Error("Outfit plan returned no structured output.");
  }

  return result.output;
}
