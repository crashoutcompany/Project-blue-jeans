import { describe, expect, it } from "vitest";

import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import { buildWeekWeather } from "@/lib/outfits/week-weather";

function day(date: string, overrides: Partial<DayForecast> = {}): DayForecast {
  return {
    date,
    highC: 20,
    lowC: 12,
    precipitationChancePercent: 10,
    weatherCode: 1,
    condition: "Partly cloudy",
    ...overrides,
  };
}

const weekStartIso = "2026-11-08";
const todayIso = "2026-11-10";

function build(params: {
  forecast: DayForecast[];
  planned?: DayForecast[];
  fitDays?: string[];
}) {
  return buildWeekWeather({
    todayIso,
    weekStartIso,
    place: "New York, NY",
    forecastByDay: new Map(params.forecast.map((d) => [d.date, d])),
    plannedByDay: new Map((params.planned ?? []).map((d) => [d.date, d])),
    fitDays: new Set(params.fitDays ?? []),
  });
}

describe("buildWeekWeather", () => {
  it("shows weather for today and later days only", () => {
    const week = build({
      forecast: [day("2026-11-09"), day("2026-11-10"), day("2026-11-12")],
    });
    expect(Object.keys(week)).toEqual(["2026-11-10", "2026-11-12"]);
    expect(week["2026-11-10"]).toEqual({
      high: "68°",
      wet: false,
      line: "New York, NY · partly cloudy · 68° / 54° · 10% rain",
    });
  });

  it("is empty when the forecast is unavailable", () => {
    expect(build({ forecast: [] })).toEqual({});
  });

  it("marks rainy days as wet", () => {
    const week = build({
      forecast: [day("2026-11-11", { weatherCode: 61, condition: "Rain" })],
    });
    expect(week["2026-11-11"]?.wet).toBe(true);
  });

  it("flags a Fit whose forecast changed since planning", () => {
    const week = build({
      forecast: [day("2026-11-11", { weatherCode: 63, condition: "Rain" })],
      planned: [day("2026-11-11")],
      fitDays: ["2026-11-11"],
    });
    expect(week["2026-11-11"]?.changed).toMatch(/rain is now in the forecast/);
  });

  it("does not flag an unchanged forecast", () => {
    const week = build({
      forecast: [day("2026-11-11", { highC: 21 })],
      planned: [day("2026-11-11")],
      fitDays: ["2026-11-11"],
    });
    expect(week["2026-11-11"]?.changed).toBeUndefined();
  });

  it("does not flag approved Outfits or Fits planned before weather existed", () => {
    const rainy = day("2026-11-11", { weatherCode: 63, condition: "Rain" });
    expect(
      build({ forecast: [rainy], planned: [day("2026-11-11")] })["2026-11-11"]
        ?.changed,
    ).toBeUndefined();
    expect(
      build({ forecast: [rainy], fitDays: ["2026-11-11"] })["2026-11-11"]
        ?.changed,
    ).toBeUndefined();
  });
});
