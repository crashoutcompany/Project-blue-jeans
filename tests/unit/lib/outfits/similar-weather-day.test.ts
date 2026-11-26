import { describe, expect, it } from "vitest";

import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import {
  findLastSimilarWornDay,
  formatSimilarDayWeather,
  isSimilarWeather,
  similarDayLookbackStartIso,
} from "@/lib/outfits/similar-weather-day";

function day(
  date: string,
  highC: number,
  opts: { code?: number; chance?: number | null; lowC?: number } = {},
): DayForecast {
  return {
    date,
    highC,
    lowC: opts.lowC ?? highC - 6,
    precipitationChancePercent: opts.chance ?? 0,
    weatherCode: opts.code ?? 1,
    condition: opts.code && opts.code >= 61 ? "Rain" : "Partly cloudy",
  };
}

const TODAY = "2026-11-26";

function forecasts(...days: DayForecast[]): Map<string, DayForecast> {
  return new Map(days.map((d) => [d.date, d]));
}

describe("isSimilarWeather", () => {
  it("matches days in the same temperature band and rain call", () => {
    expect(isSimilarWeather(day(TODAY, 12), day("2026-11-10", 15))).toBe(true);
  });

  it("rejects a different temperature band", () => {
    expect(isSimilarWeather(day(TODAY, 12), day("2026-11-10", 22))).toBe(
      false,
    );
  });

  it("rejects a dry day against a rainy one", () => {
    expect(
      isSimilarWeather(day(TODAY, 12, { code: 63 }), day("2026-11-10", 12)),
    ).toBe(false);
    expect(
      isSimilarWeather(
        day(TODAY, 12, { chance: 80 }),
        day("2026-11-10", 13, { code: 61 }),
      ),
    ).toBe(true);
  });

  it("rejects snow against rain", () => {
    expect(
      isSimilarWeather(
        day(TODAY, 1, { code: 73 }),
        day("2026-11-10", 1, { code: 63 }),
      ),
    ).toBe(false);
  });
});

describe("findLastSimilarWornDay", () => {
  const today = day(TODAY, 12, { code: 63 });

  it("returns the most recent worn day with similar weather", () => {
    const result = findLastSimilarWornDay({
      todayIso: TODAY,
      forecastByDay: forecasts(
        today,
        day("2026-11-25", 25),
        day("2026-11-20", 11, { code: 61 }),
        day("2026-11-12", 14, { code: 63 }),
      ),
      outfits: [
        { wornOn: "2026-11-12", worn: true, id: "older" },
        { wornOn: "2026-11-25", worn: true, id: "warm" },
        { wornOn: "2026-11-20", worn: true, id: "match" },
      ],
    });
    expect(result?.outfit.id).toBe("match");
    expect(result?.weather.date).toBe("2026-11-20");
  });

  it("ignores days that were committed but not marked Wore this", () => {
    const result = findLastSimilarWornDay({
      todayIso: TODAY,
      forecastByDay: forecasts(today, day("2026-11-20", 11, { code: 61 })),
      outfits: [{ wornOn: "2026-11-20", worn: false }],
    });
    expect(result).toBeNull();
  });

  it("does not match on weekday, only weather", () => {
    // 2026-11-19 is a Thursday like today, but it was hot and dry.
    const result = findLastSimilarWornDay({
      todayIso: TODAY,
      forecastByDay: forecasts(today, day("2026-11-19", 30)),
      outfits: [{ wornOn: "2026-11-19", worn: true }],
    });
    expect(result).toBeNull();
  });

  it("skips today, future days, and days without weather", () => {
    const result = findLastSimilarWornDay({
      todayIso: TODAY,
      forecastByDay: forecasts(today, day("2026-11-27", 12, { code: 63 })),
      outfits: [
        { wornOn: TODAY, worn: true },
        { wornOn: "2026-11-27", worn: true },
        { wornOn: "2026-11-21", worn: true },
      ],
    });
    expect(result).toBeNull();
  });

  it("returns null without today's forecast", () => {
    const result = findLastSimilarWornDay({
      todayIso: TODAY,
      forecastByDay: forecasts(day("2026-11-20", 12, { code: 63 })),
      outfits: [{ wornOn: "2026-11-20", worn: true }],
    });
    expect(result).toBeNull();
  });
});

describe("helpers", () => {
  it("formats a past day's weather", () => {
    expect(
      formatSimilarDayWeather(day("2026-11-20", 10, { code: 63, lowC: 5 })),
    ).toBe("rain · 50° / 41°");
  });

  it("starts the lookback 60 days before today", () => {
    expect(similarDayLookbackStartIso(TODAY)).toBe("2026-09-27");
  });
});
