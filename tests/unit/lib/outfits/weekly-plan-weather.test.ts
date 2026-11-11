import { describe, expect, it } from "vitest";

import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import {
  parsePlannedWeather,
  plannedWeatherForLooks,
} from "@/lib/outfits/weekly-plan-weather";

const wed: DayForecast = {
  date: "2026-11-11",
  highC: 8,
  lowC: 2,
  precipitationChancePercent: 70,
  weatherCode: 61,
  condition: "Rain",
};

describe("plannedWeatherForLooks", () => {
  it("keys each planned look's forecast by sort order", () => {
    const forecast = new Map([[wed.date, wed]]);
    expect(plannedWeatherForLooks("2026-11-08", [3, 4], forecast)).toEqual({
      "3": wed,
    });
  });
});

describe("parsePlannedWeather", () => {
  it("reads plannedWeather from step1_raw", () => {
    expect(parsePlannedWeather({ failedDays: [], plannedWeather: { "3": wed } })).toEqual({
      "3": wed,
    });
  });

  it("reads missing or malformed data as none", () => {
    expect(parsePlannedWeather(null)).toEqual({});
    expect(parsePlannedWeather({ failedDays: [] })).toEqual({});
    expect(parsePlannedWeather({ plannedWeather: { "9": wed } })).toEqual({});
    expect(
      parsePlannedWeather({ plannedWeather: { "3": { highC: "warm" } } }),
    ).toEqual({});
  });
});
