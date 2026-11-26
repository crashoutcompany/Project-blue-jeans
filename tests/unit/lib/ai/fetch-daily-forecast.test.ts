import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/e2e-env", () => ({ isTestingApiExposed: () => false }));

import { fetchDailyForecast } from "@/lib/ai/weather/fetch-weather";

const DAILY = {
  timezone: "America/New_York",
  daily: {
    time: ["2026-11-25", "2026-11-26"],
    temperature_2m_max: [10, 12],
    temperature_2m_min: [4, 6],
    precipitation_probability_max: [null, 80],
    weather_code: [1, 63],
  },
};

function mockFetch() {
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      calls.push(new URL(String(input)));
      return new Response(JSON.stringify(DAILY), { status: 200 });
    }),
  );
  return calls;
}

describe("fetchDailyForecast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks Open-Meteo for past days and returns them oldest first", async () => {
    const calls = mockFetch();
    const res = await fetchDailyForecast(
      { latitude: 40.7, longitude: -74 },
      { days: 7, pastDays: 60 },
    );
    expect(calls[0]!.searchParams.get("past_days")).toBe("60");
    expect(calls[0]!.searchParams.get("forecast_days")).toBe("7");
    expect(res.ok && res.days.map((d) => d.date)).toEqual([
      "2026-11-25",
      "2026-11-26",
    ]);
  });

  it("omits past_days by default and caps it at 92", async () => {
    const calls = mockFetch();
    await fetchDailyForecast({ latitude: 40.7, longitude: -74 });
    expect(calls[0]!.searchParams.has("past_days")).toBe(false);
    await fetchDailyForecast(
      { latitude: 40.7, longitude: -74 },
      { pastDays: 500 },
    );
    expect(calls[1]!.searchParams.get("past_days")).toBe("92");
  });
});
