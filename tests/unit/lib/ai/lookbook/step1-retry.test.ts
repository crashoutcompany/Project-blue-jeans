import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/lookbook/step1-plan", () => ({
  runOutfitPlanStep: vi.fn(),
}));

import { OutfitPlanError } from "@/lib/ai/lookbook/plan-error";
import { runOutfitPlanStep } from "@/lib/ai/lookbook/step1-plan";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";

const step = vi.mocked(runOutfitPlanStep);

const TOP = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const BOTTOM = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const SHOE = "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
const UNKNOWN = "f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66";

const params = {
  apiKey: "key",
  lookCount: 1,
  climate: "Temperate",
  context: "Everyday week",
  narrative: "Smart casual",
  catalogText: "catalog",
  validIds: new Set([TOP, BOTTOM, SHOE]),
  location: "New York, NY",
  weekly: true,
  weeklyWeekday: "Friday",
};

const planWith = (garmentIds: string[]) => ({
  looks: [{ title: "Look", description: "d", tags: ["day"], garmentIds }],
});

describe("runStep1PlanWithRetry", () => {
  beforeEach(() => {
    step.mockReset();
  });

  it("returns the first plan when it is valid", async () => {
    step.mockResolvedValueOnce(planWith([TOP, BOTTOM, SHOE]));

    const plan = await runStep1PlanWithRetry(params);

    expect(plan.looks[0]?.garmentIds).toEqual([TOP, BOTTOM, SHOE]);
    expect(step).toHaveBeenCalledTimes(1);
    expect(step.mock.calls[0]?.[0].narrative).toBe("Smart casual");
  });

  it("retries once with a JSON repair hint after an unreadable reply", async () => {
    step
      .mockRejectedValueOnce(new OutfitPlanError("no-object", "bad json"))
      .mockResolvedValueOnce(planWith([TOP, BOTTOM, SHOE]));

    const plan = await runStep1PlanWithRetry(params);

    expect(plan.looks[0]?.garmentIds).toEqual([TOP, BOTTOM, SHOE]);
    expect(step).toHaveBeenCalledTimes(2);
    const retryNarrative = step.mock.calls[1]?.[0].narrative ?? "";
    expect(retryNarrative).toMatch(/^Smart casual/);
    expect(retryNarrative).toMatch(/single JSON object/);
    expect(step.mock.calls[1]?.[0]).not.toHaveProperty("validIds");
  });

  it("drops unknown ids and retries with the id list when nothing is left", async () => {
    step
      .mockResolvedValueOnce(planWith([UNKNOWN]))
      .mockResolvedValueOnce(planWith([TOP, UNKNOWN, BOTTOM, SHOE]));

    const plan = await runStep1PlanWithRetry(params);

    expect(plan.looks[0]?.garmentIds).toEqual([TOP, BOTTOM, SHOE]);
    expect(step.mock.calls[1]?.[0].narrative).toContain(TOP);
  });

  it("throws a user-facing OutfitPlanError after two unreadable replies", async () => {
    step.mockRejectedValue(new OutfitPlanError("no-object", "bad json"));

    const error = await runStep1PlanWithRetry(params).catch((e: unknown) => e);

    expect(step).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(OutfitPlanError);
    expect((error as OutfitPlanError).publicMessage).toMatch(/try again/i);
  });

  it("throws invalid-ids when the retry still has no closet ids", async () => {
    step.mockResolvedValue(planWith([UNKNOWN]));

    const error = await runStep1PlanWithRetry(params).catch((e: unknown) => e);

    expect(step).toHaveBeenCalledTimes(2);
    expect((error as OutfitPlanError).reason).toBe("invalid-ids");
  });

  it("does not retry errors that are not plan errors", async () => {
    step.mockRejectedValueOnce(new Error("network down"));

    await expect(runStep1PlanWithRetry(params)).rejects.toThrow("network down");
    expect(step).toHaveBeenCalledTimes(1);
  });
});
