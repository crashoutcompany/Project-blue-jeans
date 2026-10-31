import {
  isOutfitPlanError,
  OutfitPlanError,
} from "@/lib/ai/lookbook/plan-error";
import type { AlreadyPlannedLook } from "@/lib/ai/lookbook/prompts";
import { runOutfitPlanStep } from "@/lib/ai/lookbook/step1-plan";
import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";
import {
  filterPlanToValidGarmentIds,
  planHasEmptyGarmentIds,
} from "@/lib/ai/lookbook/validate-ids";

export type RunStep1PlanWithRetryParams = {
  apiKey: string;
  lookCount: number;
  climate: string;
  context: string;
  narrative: string;
  catalogText: string;
  validIds: ReadonlySet<string>;
  location: string;
  weekly?: boolean;
  weeklyWeekday?: string;
  alreadyPlanned?: AlreadyPlannedLook[];
  mustWearIds?: string[];
  mustWearNames?: string[];
};

const MAX_ATTEMPTS = 2;

const SCHEMA_REPAIR_HINT =
  "\n\nIMPORTANT: Your previous reply could not be read. Reply with a single JSON object that matches the schema exactly: no prose, no markdown, no code fences.";

function invalidIdsHint(validIds: ReadonlySet<string>): string {
  return `\n\nIMPORTANT: You must only output garmentIds that appear in this exact list: ${[...validIds].join(", ")}`;
}

/**
 * Step 1 with invalid-id filter and one repair retry (also used by `generateLookbook`).
 * The retry prompt says what went wrong: an unreadable reply or unknown ids.
 * Throws `OutfitPlanError` when both attempts fail.
 */
export async function runStep1PlanWithRetry(
  params: RunStep1PlanWithRetryParams,
): Promise<LookbookPlan> {
  const { validIds, narrative, ...rest } = params;

  let repairHint = "";
  let lastError: OutfitPlanError | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let plan: LookbookPlan;
    try {
      plan = await runOutfitPlanStep({
        ...rest,
        narrative: narrative + repairHint,
      });
    } catch (e) {
      if (!isOutfitPlanError(e)) throw e;
      lastError = e;
      repairHint = SCHEMA_REPAIR_HINT;
      continue;
    }

    plan = filterPlanToValidGarmentIds(plan, validIds);
    if (!planHasEmptyGarmentIds(plan)) return plan;

    lastError = new OutfitPlanError(
      "invalid-ids",
      "Outfit plan used garment ids that are not in the closet.",
    );
    repairHint = invalidIdsHint(validIds);
  }

  throw lastError ?? new OutfitPlanError("no-object", "Outfit plan failed.");
}
