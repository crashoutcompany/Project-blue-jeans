import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/lookbook/step1-retry", () => ({
  runStep1PlanWithRetry: vi.fn(),
}));

import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import { categoryByIdFromCatalog } from "@/lib/outfits/look-composition";
import { planWeeklyDay } from "@/lib/workflows/weekly-plan-day";

const step1 = vi.mocked(runStep1PlanWithRetry);

function g(id: string, category: string, name: string): CatalogGarment {
  return { id, category, name, color: null, notes: null, description: null };
}

const closet = [
  g("t1", "tops", "Polo"),
  g("t2", "tops", "Tee"),
  g("b1", "bottoms", "Jeans"),
  g("b2", "bottoms", "Chinos"),
  g("s1", "shoes", "Sneakers"),
];
const categoryById = categoryByIdFromCatalog(closet);

const style = {
  apiKey: "k",
  climate: "Temperate",
  context: "Everyday week",
  narrative: "",
  location: "New York, NY",
};
const monday = { iso: "2026-08-10", sortOrder: 1, weekday: "Monday" };

function planOf(garmentIds: string[]) {
  return {
    curatorNote: "",
    looks: [{ title: "Look", description: "", tags: [], garmentIds }],
  };
}

function plan(repeat?: Parameters<typeof planWeeklyDay>[6]) {
  return planWeeklyDay(
    style,
    monday,
    closet,
    categoryById,
    new Set(),
    [],
    repeat,
  );
}

describe("planWeeklyDay repeat guard", () => {
  beforeEach(() => {
    step1.mockReset();
  });

  it("names recently worn Outfits in the prompt", async () => {
    step1.mockResolvedValue(planOf(["t2", "b2", "s1"]));

    const result = await plan({
      windowDays: 7,
      wears: [{ wornOn: "2026-08-07", garmentIds: ["t1", "b1", "s1"] }],
    });

    expect(result.status).toBe("planned");
    expect(step1).toHaveBeenCalledTimes(1);
    expect(step1.mock.calls[0]![0].avoidOutfits).toEqual([
      ["Polo", "Jeans", "Sneakers"],
    ]);
  });

  it("asks again when the model repeats a worn Outfit exactly", async () => {
    step1
      .mockResolvedValueOnce(planOf(["s1", "t1", "b1"]))
      .mockResolvedValueOnce(planOf(["t1", "b2", "s1"]));

    const result = await plan({
      windowDays: 7,
      wears: [{ wornOn: "2026-08-07", garmentIds: ["t1", "b1", "s1"] }],
    });

    expect(step1).toHaveBeenCalledTimes(2);
    expect(step1.mock.calls[1]![0].narrative).toMatch(/recently worn/);
    expect(result).toMatchObject({
      status: "planned",
      look: { garmentIds: ["t1", "b2", "s1"] },
    });
  });

  it("keeps a reused piece without asking again", async () => {
    step1.mockResolvedValue(planOf(["t1", "b2", "s1"]));

    await plan({
      windowDays: 7,
      wears: [{ wornOn: "2026-08-07", garmentIds: ["t1", "b1", "s1"] }],
    });

    expect(step1).toHaveBeenCalledTimes(1);
  });

  it("keeps the day rather than leave it empty when the model repeats twice", async () => {
    step1.mockResolvedValue(planOf(["t1", "b1", "s1"]));

    const result = await plan({
      windowDays: 7,
      wears: [{ wornOn: "2026-08-07", garmentIds: ["t1", "b1", "s1"] }],
    });

    expect(step1).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("planned");
  });

  it("does not block wears outside the window", async () => {
    step1.mockResolvedValue(planOf(["t1", "b1", "s1"]));

    await plan({
      windowDays: 7,
      wears: [{ wornOn: "2026-08-03", garmentIds: ["t1", "b1", "s1"] }],
    });

    expect(step1).toHaveBeenCalledTimes(1);
    expect(step1.mock.calls[0]![0].avoidOutfits).toBeUndefined();
  });

  it("lets the oldest wears repeat when the closet is too small", async () => {
    const tiny = [
      g("t1", "tops", "Polo"),
      g("b1", "bottoms", "Jeans"),
      g("b2", "bottoms", "Chinos"),
      g("s1", "shoes", "Sneakers"),
    ];
    step1.mockResolvedValue(planOf(["t1", "b1", "s1"]));

    const result = await planWeeklyDay(
      style,
      monday,
      tiny,
      categoryByIdFromCatalog(tiny),
      new Set(),
      [],
      {
        windowDays: 7,
        wears: [
          { wornOn: "2026-08-08", garmentIds: ["t1", "b2", "s1"] },
          { wornOn: "2026-08-05", garmentIds: ["t1", "b1", "s1"] },
        ],
      },
    );

    // Only the newest wear is avoided; the oldest may come back, so the
    // model's pick is accepted on the first try.
    expect(step1).toHaveBeenCalledTimes(1);
    expect(step1.mock.calls[0]![0].avoidOutfits).toEqual([
      ["Polo", "Chinos", "Sneakers"],
    ]);
    expect(result).toMatchObject({
      status: "planned",
      look: { garmentIds: ["t1", "b1", "s1"] },
    });
  });

  it("plans as before with no repeat window", async () => {
    step1.mockResolvedValue(planOf(["t1", "b1", "s1"]));

    await plan();

    expect(step1).toHaveBeenCalledTimes(1);
    expect(step1.mock.calls[0]![0].avoidOutfits).toBeUndefined();
  });
});
