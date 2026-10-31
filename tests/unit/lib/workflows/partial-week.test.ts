import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Partial weeks and "Regenerate this day" through the real step-1 path
 * (`generateText` + `Output.object` + repair retry) on a mocked model. No
 * Gemini call and no database: SQL is a recording fake.
 */

type GenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;
type GenerateOptions = Parameters<MockLanguageModelV3["doGenerate"]>[0];

const { model } = vi.hoisted(() => ({
  model: { current: undefined as unknown },
}));

vi.mock("@/lib/ai/gemini-provider", () => ({
  geminiModel: () => model.current,
}));

vi.mock("@/lib/ai/weather/fetch-weather", () => ({
  fetchWeather: vi.fn(async () => ({ ok: true, summary: "12°C, light rain" })),
}));

vi.mock("@/lib/ai/lookbook/step2-image", () => ({
  runHeroImageStep: vi.fn(async () => null),
}));

vi.mock("@/lib/media/owned-image", () => ({
  resolveGarmentImageSourcesForAi: vi.fn(async () => [
    { url: "https://cdn.example.com/g.jpg" },
  ]),
  resolveOwnedImageFetchUrl: vi.fn(async () => null),
}));

vi.mock("@/lib/media/hero-assets", () => ({
  createHeroImageStore: () => vi.fn(),
}));

vi.mock("@/lib/credentials/resolve", () => ({
  resolveGeminiApiKey: vi.fn(async () => ({ ok: true, apiKey: "test-key" })),
}));

vi.mock("@/lib/garments/load-catalog", () => ({
  loadGarmentCatalog: vi.fn(),
  loadGarmentsByIds: vi.fn(async () => []),
}));

vi.mock("@/lib/wearer/profile", () => ({
  getWearerPhoto: vi.fn(async () => null),
}));

vi.mock("@/lib/wearer/preferences", () => ({
  getWearerLocation: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/outfits/day-looks-in-range", () => ({
  loadOutfitsInRange: vi.fn(),
}));

vi.mock("@/lib/outfits/existing-outfit-heroes", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/outfits/existing-outfit-heroes")
  >()),
  findExistingOutfitHeroUrls: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/server/safe-client-error", () => ({
  logServerError: vi.fn(),
}));

import { requireSql } from "@/lib/db";
import { loadGarmentCatalog } from "@/lib/garments/load-catalog";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import { logServerError } from "@/lib/server/safe-client-error";
import { regenerateWeeklyDay } from "@/lib/workflows/regenerate-weekly-day";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";

const TOP_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TOP_B = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const BOTTOM = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const SHOE = "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
const TOP_C = "f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66";
const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";
const WEEK_START = "2026-08-09";
/** Thursday 2026-08-13 noon in New York: Thursday, Friday, Saturday remain. */
const THURSDAY = new Date("2026-08-13T16:00:00.000Z");

const garment = (id: string, category: string, name: string) => ({
  id,
  category,
  name,
  color: null,
  notes: null,
  description: null,
});

const closet = [
  garment(TOP_A, "tops", "Polo"),
  garment(TOP_B, "tops", "Tee"),
  garment(BOTTOM, "bottoms", "Jeans"),
  garment(SHOE, "shoes", "Sneakers"),
];

const closetWithSpareTop = [...closet, garment(TOP_C, "tops", "Oxford")];

const style = {
  climate: "Temperate",
  context: "Everyday week",
  narrative: "",
};

function reply(text: string): GenerateResult {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: {
        total: 10,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 10, text: undefined, reasoning: undefined },
    },
    warnings: [],
  };
}

const lookReply = (title: string, garmentIds: string[]) =>
  reply(
    JSON.stringify({
      looks: [{ title, description: "d", tags: ["day"], garmentIds }],
    }),
  );

const UNREADABLE = reply("Sorry, I can't style this day.");

function weekdayOf(options: GenerateOptions): string {
  const match = /planning \*\*one day\*\* of the user's week: \*\*(\w+)\*\*/.exec(
    JSON.stringify(options.prompt),
  );
  return match?.[1] ?? "unknown";
}

/** Answer each weekday's prompt with `replies[weekday]`. */
function useModel(
  replies: Record<string, (options: GenerateOptions) => GenerateResult>,
) {
  const mock = new MockLanguageModelV3({
    doGenerate: async (options) => {
      const answer = replies[weekdayOf(options)];
      if (!answer) throw new Error(`unexpected day ${weekdayOf(options)}`);
      return answer(options);
    },
  });
  model.current = mock;
  return mock;
}

/** Prompts the model saw for one weekday (first attempt + any repair). */
function promptsFor(mock: MockLanguageModelV3, weekday: string): string[] {
  return mock.doGenerateCalls
    .filter((c) => weekdayOf(c) === weekday)
    .map((c) => JSON.stringify(c.prompt));
}

type SqlCall = { text: string; values: unknown[] };

function mockSql(state: {
  calls: SqlCall[];
  plan?: { id: string; status: string; step1_raw: unknown };
  looks?: { sort_order: number; title: string; garment_ids: string[] }[];
  claimHeld?: boolean;
}) {
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ");
    state.calls.push({ text, values });
    if (text.includes("INSERT INTO weekly_plan_claims")) {
      return Promise.resolve(state.claimHeld ? [] : [{ token: PLAN_ID }]);
    }
    if (text.includes("FROM weekly_outfit_plans")) {
      return Promise.resolve(state.plan ? [state.plan] : []);
    }
    if (text.includes("FROM weekly_plan_looks")) {
      return Promise.resolve(state.looks ?? []);
    }
    if (text.includes("INSERT INTO weekly_outfit_plans")) {
      return Promise.resolve([{ id: PLAN_ID }]);
    }
    return Promise.resolve([]);
  });
  vi.mocked(requireSql).mockReturnValue(sql as never);
}

const lookInserts = (calls: SqlCall[]) =>
  calls.filter((c) => c.text.includes("INSERT INTO weekly_plan_looks"));

function storedStep1Raw(calls: SqlCall[]) {
  const write = calls.find(
    (c) =>
      c.text.includes("INSERT INTO weekly_outfit_plans") ||
      (c.text.includes("UPDATE weekly_outfit_plans") &&
        c.text.includes("step1_raw")),
  );
  return write;
}

beforeEach(() => {
  vi.clearAllMocks();
  model.current = undefined;
  vi.mocked(loadGarmentCatalog).mockResolvedValue(closet);
  vi.mocked(loadOutfitsInRange).mockResolvedValue([]);
});

describe("runWeeklyOutfitsJob partial week", () => {
  it("saves the planned days and records only the day the model could not plan", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls });
    const mock = useModel({
      Thursday: () => lookReply("Thursday office", [TOP_A, BOTTOM, SHOE]),
      Friday: () => UNREADABLE,
      Saturday: () => lookReply("Saturday errands", [TOP_B, BOTTOM, SHOE]),
    });

    const res = await runWeeklyOutfitsJob(
      { userId: USER_ID, weekStart: WEEK_START, ...style },
      THURSDAY,
    );

    expect(res).toEqual({
      ok: true,
      planId: PLAN_ID,
      skipped: false,
      failedDays: [
        {
          sortOrder: 5,
          message:
            "Couldn't plan Friday. The stylist couldn't put an outfit together this time. Try again in a moment.",
        },
      ],
    });
    // Friday got its one repair retry before the week moved on.
    expect(promptsFor(mock, "Friday")).toHaveLength(2);
    expect(lookInserts(calls).map((c) => c.values[1])).toEqual([4, 6]);

    const insert = storedStep1Raw(calls);
    const raw = JSON.parse(String(insert?.values[1]));
    expect(raw.failedDays).toEqual([
      { sortOrder: 5, message: expect.stringMatching(/^Couldn't plan Friday\./) },
    ]);
    expect(
      calls.some(
        (c) =>
          c.text.includes("SET status = 'completed'") &&
          c.values.includes(PLAN_ID),
      ),
    ).toBe(true);
    expect(vi.mocked(logServerError)).toHaveBeenCalledWith(
      expect.stringMatching(/day=Friday garments=3 plannedDays=1/),
      expect.anything(),
    );
  });

  it("does not lock a failed day's top, so a later day may use it", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls });
    const mock = useModel({
      Thursday: () => UNREADABLE,
      Friday: () => lookReply("Friday commute", [TOP_A, BOTTOM, SHOE]),
      Saturday: () => lookReply("Saturday errands", [TOP_B, BOTTOM, SHOE]),
    });

    const res = await runWeeklyOutfitsJob(
      { userId: USER_ID, weekStart: WEEK_START, ...style },
      THURSDAY,
    );

    expect(res.ok).toBe(true);
    expect(promptsFor(mock, "Friday")[0]).toContain(TOP_A);
    expect(promptsFor(mock, "Saturday")[0]).not.toContain(TOP_A);
    expect(lookInserts(calls).map((c) => c.values[1])).toEqual([5, 6]);
  });

  it("fails without saving when no day could be planned", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls });
    useModel({
      Thursday: () => UNREADABLE,
      Friday: () => UNREADABLE,
      Saturday: () => UNREADABLE,
    });

    const res = await runWeeklyOutfitsJob(
      { userId: USER_ID, weekStart: WEEK_START, ...style },
      THURSDAY,
    );

    expect(res).toEqual({
      ok: false,
      error: expect.stringMatching(/^Couldn't plan Thursday\. /),
    });
    expect(storedStep1Raw(calls)).toBeUndefined();
    expect(lookInserts(calls)).toHaveLength(0);
  });
});

describe("regenerateWeeklyDay", () => {
  const savedPlan = {
    id: PLAN_ID,
    status: "completed",
    step1_raw: {
      source: "weekly_sequential_step1",
      plans: [],
      failedDays: [
        { sortOrder: 5, message: "Couldn't plan Friday. Try again in a moment." },
      ],
    },
  };
  const savedLooks = [
    { sort_order: 4, title: "Thursday office", garment_ids: [TOP_A, BOTTOM, SHOE] },
    { sort_order: 6, title: "Saturday errands", garment_ids: [TOP_B, BOTTOM, SHOE] },
  ];
  const friday = {
    userId: USER_ID,
    weekStart: WEEK_START,
    wornOn: "2026-08-14",
    ...style,
  };

  it("plans the failed day, leaves the other days alone and clears the error", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks });
    vi.mocked(loadGarmentCatalog).mockResolvedValue(closetWithSpareTop);
    const mock = useModel({
      Friday: () => lookReply("Friday commute", [TOP_C, BOTTOM, SHOE]),
    });

    const res = await regenerateWeeklyDay(friday, THURSDAY);

    expect(res).toEqual({ ok: true });
    const [prompt] = promptsFor(mock, "Friday");
    // Tops from the other days stay locked; their looks are context.
    expect(prompt).not.toContain(TOP_A);
    expect(prompt).not.toContain(TOP_B);
    expect(prompt).toContain("Thursday office");
    expect(prompt).toContain("Saturday errands");

    const inserts = lookInserts(calls);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.text).toContain("ON CONFLICT (plan_id, sort_order)");
    expect(inserts[0]?.values.slice(0, 3)).toEqual([
      PLAN_ID,
      5,
      "Friday commute",
    ]);
    expect(
      calls.some(
        (c) =>
          c.text.includes("DELETE FROM weekly_plan_looks") ||
          c.text.includes("INSERT INTO weekly_outfit_plans"),
      ),
    ).toBe(false);
    const failedDaysWrite = calls.find((c) => c.text.includes("jsonb_set"));
    expect(failedDaysWrite?.values[0]).toBe("[]");
  });

  it("replaces an existing Fit for that day in place", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks });
    useModel({
      Saturday: () => lookReply("Saturday reset", [TOP_B, BOTTOM, SHOE]),
    });

    const res = await regenerateWeeklyDay(
      { ...friday, wornOn: "2026-08-15" },
      THURSDAY,
    );

    expect(res).toEqual({ ok: true });
    const inserts = lookInserts(calls);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values.slice(1, 3)).toEqual([6, "Saturday reset"]);
  });

  it("keeps the day's error on Today when the model fails again", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks });
    vi.mocked(loadGarmentCatalog).mockResolvedValue(closetWithSpareTop);
    useModel({ Friday: () => UNREADABLE });

    const res = await regenerateWeeklyDay(friday, THURSDAY);

    expect(res).toEqual({
      ok: false,
      message: expect.stringMatching(/^Couldn't plan Friday\. The stylist/),
    });
    expect(lookInserts(calls)).toHaveLength(0);
    const failedDaysWrite = calls.find((c) => c.text.includes("jsonb_set"));
    expect(JSON.parse(String(failedDaysWrite?.values[0]))).toEqual([
      { sortOrder: 5, message: res.ok ? "" : res.message },
    ]);
  });

  it("keeps an existing Fit untouched when its regeneration fails", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks });
    useModel({ Saturday: () => UNREADABLE });

    const res = await regenerateWeeklyDay(
      { ...friday, wornOn: "2026-08-15" },
      THURSDAY,
    );

    expect(res.ok).toBe(false);
    expect(lookInserts(calls)).toHaveLength(0);
    expect(calls.some((c) => c.text.includes("jsonb_set"))).toBe(false);
  });

  it.each([
    ["a past day", { wornOn: "2026-08-12" }, {}, /Past looks/],
    ["a day outside this week", { wornOn: "2026-08-16" }, {}, /not in this week/],
    ["a week being planned", {}, { claimHeld: true }, /already being planned/],
    ["a week with no plan", {}, { plan: undefined }, /Plan your week first/],
  ])("refuses %s without calling the model", async (_, inputPatch, sqlPatch, message) => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks, ...sqlPatch });
    const mock = useModel({});

    const res = await regenerateWeeklyDay({ ...friday, ...inputPatch }, THURSDAY);

    expect(res).toEqual({ ok: false, message: expect.stringMatching(message) });
    expect(mock.doGenerateCalls).toHaveLength(0);
  });

  it("says so when every top is already used this week", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks });
    const mock = useModel({});

    const res = await regenerateWeeklyDay(friday, THURSDAY);

    expect(res).toEqual({
      ok: false,
      message: expect.stringMatching(/^Couldn't plan Friday\. Every top/),
    });
    expect(mock.doGenerateCalls).toHaveLength(0);
  });

  it("refuses a day that already has an Outfit", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: savedLooks });
    vi.mocked(loadOutfitsInRange).mockResolvedValue([
      {
        wornOn: "2026-08-14",
        id: PLAN_ID,
        name: null,
        imageUrl: null,
        occasion: "casual",
        garmentIds: [TOP_A],
      },
    ]);
    const mock = useModel({});

    const res = await regenerateWeeklyDay(friday, THURSDAY);

    expect(res).toEqual({
      ok: false,
      message: expect.stringMatching(/already has an Outfit/),
    });
    expect(mock.doGenerateCalls).toHaveLength(0);
  });
});
