import { runOutfitPlanStep } from "@/lib/ai/lookbook/step1-plan";
import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";
import {
  filterPlanToValidGarmentIds,
  planHasEmptyGarmentIds,
} from "@/lib/ai/lookbook/validate-ids";

export type RunStep1PlanWithRetryParams = {
  lookCount: number;
  climate: string;
  context: string;
  narrative: string;
  catalogText: string;
  validIds: ReadonlySet<string>;
  weekly?: boolean;
  /** When set with `weekly` and `lookCount === 1`, prompt targets that weekday only. */
  weeklyDayIndex?: number;
};

/**
 * Step 1 with invalid-id filter + one retry (same behavior as `generateLookbook`).
 */
export async function runStep1PlanWithRetry(
  params: RunStep1PlanWithRetryParams,
): Promise<LookbookPlan> {
  const {
    lookCount,
    climate,
    context,
    narrative,
    catalogText,
    validIds,
    weekly,
    weeklyDayIndex,
  } = params;

  let plan = await runOutfitPlanStep({
    lookCount,
    climate,
    context,
    narrative,
    catalogText,
    weekly,
    weeklyDayIndex,
  });

  plan = filterPlanToValidGarmentIds(plan, validIds);

  if (planHasEmptyGarmentIds(plan)) {
    plan = await runOutfitPlanStep({
      lookCount,
      climate,
      context,
      narrative:
        narrative +
        `\n\nIMPORTANT: You must only output garmentIds that appear in this exact list: ${[...validIds].join(", ")}`,
      catalogText,
      weekly,
      weeklyDayIndex,
    });
    plan = filterPlanToValidGarmentIds(plan, validIds);
  }

  if (planHasEmptyGarmentIds(plan)) {
    throw new Error(
      "The model returned garment ids that do not match your closet. Try again or improve descriptions.",
    );
  }

  return plan;
}
