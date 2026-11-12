import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Weather-aware planning through the real step-1 path on a mocked model:
 * each day's forecast reaches its prompt, suede stays out on rainy days,
 * the plan-time forecast is stored for change flags, and a forecast outage
 * still plans. No Gemini, weather, or database calls.
 */

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
type GenerateOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

const { model } = vi.hoisted(() => ({
  model: { current: undefined as unknown },
}));

vi.mock("@/lib/ai/gemini-provider", () => ({
  geminiModel: () => model.current,
}));

vi.mock("@/lib/ai/weather/fetch-weather", () => ({
  fetchWeather: vi.fn(async () => ({ ok: true, summary: "12°C, light rain" })),
}));

vi.mock("@/lib/ai/weather/load-day-forecasts", () => ({
  loadDayForecasts: vi.fn(),
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

vi.mock("@/lib/workflows/repeat-window", () => ({
  loadRepeatWindow: vi.fn(async () => ({ wears: [], windowDays: 7 })),
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

import { loadDayForecasts } from "@/lib/ai/weather/load-day-forecasts";
import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import { requireSql } from "@/lib/db";
import { loadGarmentCatalog } from "@/lib/garments/load-catalog";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
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
  const mock = new MockLanguageModelV4({
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
function promptsFor(mock: MockLanguageModelV4, weekday: string): string[] {
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

const SUEDE_SHOE = "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

const dryFriday: DayForecast = {
  date: "2026-08-14",
  highC: 24,
  lowC: 17,
  precipitationChancePercent: 10,
  weatherCode: 1,
  condition: "Partly cloudy",
};
const rainyThursday: DayForecast = {
  date: "2026-08-13",
  highC: 8,
  lowC: 3,
  precipitationChancePercent: 90,
  weatherCode: 63,
  condition: "Rain",
};

const suedeCloset = [
  ...closetWithSpareTop,
  garment(SUEDE_SHOE, "shoes", "Tan suede loafers"),
];

describe("runWeeklyOutfitsJob with a forecast", () => {
  it("gives each day its own forecast, keeps suede off a rainy day, and stores the forecast", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls });
    vi.mocked(loadGarmentCatalog).mockResolvedValue(suedeCloset);
    vi.mocked(loadDayForecasts).mockResolvedValue(
      new Map([
        [rainyThursday.date, rainyThursday],
        [dryFriday.date, dryFriday],
      ]),
    );
    const mock = useModel({
      Thursday: () => lookReply("Thursday rain", [TOP_A, BOTTOM, SHOE]),
      Friday: () => lookReply("Friday sun", [TOP_B, BOTTOM, SUEDE_SHOE]),
      Saturday: () => UNREADABLE,
    });

    const res = await runWeeklyOutfitsJob(
      { userId: USER_ID, weekStart: WEEK_START, ...style },
      THURSDAY,
    );
    expect(res.ok).toBe(true);

    const [thursday] = promptsFor(mock, "Thursday");
    expect(thursday).toContain("Forecast for Thursday in New York, NY: Rain");
    expect(thursday).toMatch(/Cold day: add layers/);
    expect(thursday).toMatch(/avoid suede/);
    expect(thursday).not.toContain(SUEDE_SHOE);
    expect(thursday).not.toContain("call getWeather for this place");

    const [friday] = promptsFor(mock, "Friday");
    expect(friday).toContain("Forecast for Friday in New York, NY: Partly cloudy");
    expect(friday).toContain(SUEDE_SHOE);

    // Saturday had no forecast: it falls back to the getWeather tool.
    const [saturday] = promptsFor(mock, "Saturday");
    expect(saturday).toContain("call getWeather for this place");

    const raw = JSON.parse(String(storedStep1Raw(calls)?.values[1]));
    expect(raw.plannedWeather).toEqual({ "4": rainyThursday, "5": dryFriday });
  });

  it("still plans the week when the forecast is unavailable", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls });
    vi.mocked(loadDayForecasts).mockResolvedValue(new Map());
    const mock = useModel({
      Thursday: () => lookReply("Thursday office", [TOP_A, BOTTOM, SHOE]),
      Friday: () => lookReply("Friday commute", [TOP_B, BOTTOM, SHOE]),
      Saturday: () => UNREADABLE,
    });

    const res = await runWeeklyOutfitsJob(
      { userId: USER_ID, weekStart: WEEK_START, ...style },
      THURSDAY,
    );

    expect(res.ok).toBe(true);
    expect(promptsFor(mock, "Thursday")[0]).not.toContain("Forecast for");
    expect(lookInserts(calls)).toHaveLength(2);
    const raw = JSON.parse(String(storedStep1Raw(calls)?.values[1]));
    expect(raw.plannedWeather).toEqual({});
  });
});

describe("regenerateWeeklyDay with a forecast", () => {
  const savedPlan = {
    id: PLAN_ID,
    status: "completed",
    step1_raw: {
      source: "weekly_sequential_step1",
      plans: [],
      failedDays: [],
      plannedWeather: { "5": { ...dryFriday, highC: 30 } },
    },
  };

  it("replans against today's forecast and replaces the stored one", async () => {
    const calls: SqlCall[] = [];
    mockSql({
      calls,
      plan: savedPlan,
      looks: [{ sort_order: 5, title: "Old Friday", garment_ids: [TOP_A, BOTTOM, SHOE] }],
    });
    vi.mocked(loadDayForecasts).mockResolvedValue(
      new Map([[dryFriday.date, dryFriday]]),
    );
    const mock = useModel({
      Friday: () => lookReply("Friday commute", [TOP_B, BOTTOM, SHOE]),
    });

    const res = await regenerateWeeklyDay(
      { userId: USER_ID, weekStart: WEEK_START, wornOn: "2026-08-14", ...style },
      THURSDAY,
    );

    expect(res).toEqual({ ok: true });
    expect(promptsFor(mock, "Friday")[0]).toContain("Forecast for Friday");
    const weatherWrite = calls.find((c) => c.text.includes("'{plannedWeather}'"));
    expect(weatherWrite?.text).toContain("jsonb_build_object");
    expect(weatherWrite?.values).toEqual([
      "5",
      JSON.stringify(dryFriday),
      PLAN_ID,
    ]);
  });

  it("clears the stored forecast when none is available now", async () => {
    const calls: SqlCall[] = [];
    mockSql({ calls, plan: savedPlan, looks: [] });
    vi.mocked(loadDayForecasts).mockResolvedValue(new Map());
    useModel({
      Friday: () => lookReply("Friday commute", [TOP_B, BOTTOM, SHOE]),
    });

    await regenerateWeeklyDay(
      { userId: USER_ID, weekStart: WEEK_START, wornOn: "2026-08-14", ...style },
      THURSDAY,
    );

    const weatherWrite = calls.find((c) => c.text.includes("'{plannedWeather}'"));
    expect(weatherWrite?.text).not.toContain("jsonb_build_object");
    expect(weatherWrite?.values).toEqual(["5", PLAN_ID]);
  });
});
