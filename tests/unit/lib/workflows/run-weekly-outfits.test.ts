import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveGeminiApiKey: vi.fn(),
}));

vi.mock("@/lib/garments/load-catalog", () => ({
  loadGarmentCatalog: vi.fn(),
  loadGarmentsByIds: vi.fn(),
}));

vi.mock("@/lib/ai/lookbook/step1-retry", () => ({
  runStep1PlanWithRetry: vi.fn(),
}));

vi.mock("@/lib/ai/lookbook/step2-image", () => ({
  runHeroImageStep: vi.fn(),
}));

vi.mock("@/lib/wearer/profile", () => ({
  getWearerPhoto: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/outfits/day-looks-in-range", () => ({
  loadOutfitsInRange: vi.fn(),
}));

vi.mock("@/lib/server/safe-client-error", () => ({
  logServerError: vi.fn(),
}));

import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { requireSql } from "@/lib/db";
import {
  loadGarmentCatalog,
  loadGarmentsByIds,
} from "@/lib/garments/load-catalog";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import { getWearerPhoto } from "@/lib/wearer/profile";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

const resolveGemini = vi.mocked(resolveGeminiApiKey);
const loadCatalog = vi.mocked(loadGarmentCatalog);
const loadByIds = vi.mocked(loadGarmentsByIds);
const step1 = vi.mocked(runStep1PlanWithRetry);
const hero = vi.mocked(runHeroImageStep);
const wearerPhoto = vi.mocked(getWearerPhoto);
const requireSqlMock = vi.mocked(requireSql);
const loadOutfits = vi.mocked(loadOutfitsInRange);

const TOP_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TOP_B = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const BOTTOM_A = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const BOTTOM_B = "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const SHOE_A = "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";
const WEEK_START = "2026-08-09";
const FRIDAY_NOON_UTC = new Date("2026-08-14T16:00:00.000Z");
const SATURDAY_NOON_UTC = new Date("2026-08-15T16:00:00.000Z");

const closet = [
  {
    id: TOP_A,
    category: "tops",
    name: "Polo",
    color: null,
    notes: null,
    description: null,
  },
  {
    id: TOP_B,
    category: "tops",
    name: "Tee",
    color: null,
    notes: null,
    description: null,
  },
  {
    id: BOTTOM_A,
    category: "bottoms",
    name: "Grey trousers",
    color: null,
    notes: null,
    description: null,
  },
  {
    id: BOTTOM_B,
    category: "bottoms",
    name: "Jeans",
    color: null,
    notes: null,
    description: null,
  },
  {
    id: SHOE_A,
    category: "shoes",
    name: "Sneakers",
    color: null,
    notes: null,
    description: null,
  },
];

function sqlText(strings: TemplateStringsArray) {
  return strings.join(" ");
}

type SqlCall = { text: string; values: unknown[] };

function mockSql(state: {
  planRows?: { id: string; status: string }[];
  retainedLooks?: {
    sort_order: number;
    title: string;
    garment_ids: string[];
  }[];
  calls: SqlCall[];
}) {
  return vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = sqlText(strings);
    state.calls.push({ text, values });
    if (text.includes("FROM weekly_outfit_plans")) {
      return Promise.resolve(state.planRows ?? []);
    }
    if (text.includes("FROM weekly_plan_looks") && text.includes("sort_order <")) {
      return Promise.resolve(state.retainedLooks ?? []);
    }
    if (text.includes("INSERT INTO weekly_outfit_plans")) {
      return Promise.resolve([{ id: PLAN_ID }]);
    }
    return Promise.resolve([]);
  });
}

const input = {
  userId: USER_ID,
  weekStart: WEEK_START,
  climate: "Temperate",
  context: "Everyday week",
  narrative: "",
};

describe("runWeeklyOutfitsJob sequential uniqueness", () => {
  beforeEach(() => {
    resolveGemini.mockReset();
    loadCatalog.mockReset();
    loadByIds.mockReset();
    step1.mockReset();
    hero.mockReset();
    wearerPhoto.mockReset();
    requireSqlMock.mockReset();
    loadOutfits.mockReset();
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    loadOutfits.mockResolvedValue([]);
    wearerPhoto.mockResolvedValue(null);
    hero.mockResolvedValue("https://cdn.example.com/hero.jpg");
    loadByIds.mockImplementation(async (_userId, ids) =>
      ids.map((id) => {
        const g = closet.find((c) => c.id === id)!;
        return {
          id,
          name: g.name,
          category: g.category,
          color: null,
          notes: null,
          description: null,
          image_url: `https://cdn.example.com/${id}.jpg`,
        };
      }),
    );
  });

  it("skips when every remaining day already has an Outfit", async () => {
    const calls: SqlCall[] = [];
    requireSqlMock.mockReturnValue(mockSql({ calls }) as never);
    loadOutfits.mockResolvedValue([
      {
        wornOn: "2026-08-15",
        id: PLAN_ID,
        name: null,
        imageUrl: null,
        occasion: "casual",
        garmentIds: [TOP_A],
      },
    ]);
    resolveGemini.mockResolvedValue({
      ok: false,
      message: "Connect Google AI Studio in Settings before using this feature.",
    });

    const res = await runWeeklyOutfitsJob(input, SATURDAY_NOON_UTC);

    expect(res).toEqual({ ok: true, planId: "", skipped: true });
    expect(step1).not.toHaveBeenCalled();
    expect(resolveGemini).not.toHaveBeenCalled();
  });

  it("plans remaining days sequentially with a shrinking catalog", async () => {
    const calls: SqlCall[] = [];
    requireSqlMock.mockReturnValue(mockSql({ calls }) as never);

    step1.mockImplementation(async (params) => {
      const ids = [...params.validIds];
      if (params.weeklyWeekday === "Friday") {
        return {
          looks: [
            {
              title: "Friday commute",
              description: "d",
              tags: ["day"],
              garmentIds: [TOP_A, BOTTOM_A, SHOE_A],
            },
          ],
          curatorNote: "",
        };
      }
      return {
        looks: [
          {
            title: "Saturday errands",
            description: "d",
            tags: ["day"],
            garmentIds: ids.includes(TOP_B)
              ? [TOP_B, BOTTOM_B, SHOE_A]
              : [TOP_A, BOTTOM_B, SHOE_A],
          },
        ],
        curatorNote: "",
      };
    });

    const res = await runWeeklyOutfitsJob(input, FRIDAY_NOON_UTC);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.skipped).toBe(false);
    expect(step1).toHaveBeenCalledTimes(2);

    const first = step1.mock.calls[0]![0];
    const second = step1.mock.calls[1]![0];
    expect(first.weeklyWeekday).toBe("Friday");
    expect(first.alreadyPlanned).toEqual([]);
    expect([...first.validIds].sort()).toEqual(
      [TOP_A, TOP_B, BOTTOM_A, BOTTOM_B, SHOE_A].sort(),
    );

    expect(second.weeklyWeekday).toBe("Saturday");
    expect(second.alreadyPlanned).toEqual([
      {
        weekday: "Friday",
        title: "Friday commute",
        garmentNames: ["Polo", "Grey trousers", "Sneakers"],
      },
    ]);
    expect([...second.validIds].sort()).toEqual(
      [TOP_B, BOTTOM_B, SHOE_A].sort(),
    );
    expect(second.validIds.has(TOP_A)).toBe(false);

    const lookInserts = calls.filter((c) =>
      c.text.includes("INSERT INTO weekly_plan_looks"),
    );
    expect(lookInserts.map((c) => c.values[1])).toEqual([5, 6]);
    expect(hero).toHaveBeenCalledTimes(2);
  });

  it("does not persist if a later day's step-1 fails", async () => {
    const calls: SqlCall[] = [];
    requireSqlMock.mockReturnValue(mockSql({ calls }) as never);
    step1
      .mockResolvedValueOnce({
        looks: [
          {
            title: "Friday commute",
            description: "d",
            tags: ["day"],
            garmentIds: [TOP_A, BOTTOM_A, SHOE_A],
          },
        ],
        curatorNote: "",
      })
      .mockRejectedValueOnce(new Error("model down"));

    const res = await runWeeklyOutfitsJob(input, FRIDAY_NOON_UTC);

    expect(res.ok).toBe(false);
    expect(
      calls.some((c) => c.text.includes("INSERT INTO weekly_outfit_plans")),
    ).toBe(false);
    expect(
      calls.some((c) => c.text.includes("INSERT INTO weekly_plan_looks")),
    ).toBe(false);
  });

  it("omits Outfit-locked garments from the first remaining day", async () => {
    const calls: SqlCall[] = [];
    requireSqlMock.mockReturnValue(mockSql({ calls }) as never);
    loadOutfits.mockResolvedValue([
      {
        wornOn: "2026-08-14",
        id: PLAN_ID,
        name: null,
        imageUrl: null,
        occasion: "casual",
        garmentIds: [TOP_A],
      },
    ]);
    step1.mockResolvedValue({
      looks: [
        {
          title: "Saturday errands",
          description: "d",
          tags: ["day"],
          garmentIds: [TOP_B, BOTTOM_A, SHOE_A],
        },
      ],
      curatorNote: "",
    });

    await runWeeklyOutfitsJob(input, FRIDAY_NOON_UTC);

    expect(step1).toHaveBeenCalledTimes(1);
    const only = step1.mock.calls[0]![0];
    expect(only.weeklyWeekday).toBe("Saturday");
    expect(only.validIds.has(TOP_A)).toBe(false);
    expect(only.validIds.has(TOP_B)).toBe(true);
  });

  it("locks garments from retained past-day Fits before planning remaining days", async () => {
    const calls: SqlCall[] = [];
    requireSqlMock.mockReturnValue(
      mockSql({
        calls,
        planRows: [{ id: PLAN_ID, status: "failed" }],
        retainedLooks: [
          {
            sort_order: 4,
            title: "Thursday office",
            garment_ids: [TOP_A, BOTTOM_A, SHOE_A],
          },
        ],
      }) as never,
    );
    step1.mockResolvedValue({
      looks: [
        {
          title: "Friday commute",
          description: "d",
          tags: ["day"],
          garmentIds: [TOP_B, BOTTOM_B, SHOE_A],
        },
      ],
      curatorNote: "",
    });

    const res = await runWeeklyOutfitsJob(input, FRIDAY_NOON_UTC);

    expect(res.ok).toBe(true);
    const first = step1.mock.calls[0]![0];
    expect(first.weeklyWeekday).toBe("Friday");
    expect(first.alreadyPlanned).toEqual([
      {
        weekday: "Thursday",
        title: "Thursday office",
        garmentNames: ["Polo", "Grey trousers", "Sneakers"],
      },
    ]);
    expect([...first.validIds].sort()).toEqual(
      [TOP_B, BOTTOM_B, SHOE_A].sort(),
    );
    expect(first.validIds.has(TOP_A)).toBe(false);
    expect(first.validIds.has(BOTTOM_A)).toBe(false);
  });
});
