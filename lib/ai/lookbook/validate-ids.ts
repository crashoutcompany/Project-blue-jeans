import type { LookbookPlan } from "@/lib/ai/lookbook/schemas";

export function filterPlanToValidGarmentIds(
  plan: LookbookPlan,
  validIds: ReadonlySet<string>,
): LookbookPlan {
  return {
    ...plan,
    looks: plan.looks.map((look) => ({
      ...look,
      garmentIds: look.garmentIds.filter((id) => validIds.has(id)),
    })),
  };
}

export function planHasEmptyGarmentIds(plan: LookbookPlan): boolean {
  return plan.looks.some((l) => l.garmentIds.length === 0);
}
