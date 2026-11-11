import { describe, expect, it } from "vitest";

import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import {
  classifyDayWeather,
  dayWeatherPrompt,
  dayWeatherRules,
  forecastChangeReason,
  formatDayHigh,
  formatDayWeatherLine,
  weatherSafeGarments,
} from "@/lib/ai/weather/day-weather-rules";
import type { DayForecast } from "@/lib/ai/weather/fetch-weather";

function day(overrides: Partial<DayForecast> = {}): DayForecast {
  return {
    date: "2026-11-11",
    highC: 20,
    lowC: 12,
    precipitationChancePercent: 10,
    weatherCode: 1,
    condition: "Partly cloudy",
    ...overrides,
  };
}

const rainy = day({ weatherCode: 63, condition: "Rain", precipitationChancePercent: 80 });

function garment(
  id: string,
  category: string,
  name: string,
  extra: Partial<CatalogGarment> = {},
): CatalogGarment {
  return { id, category, name, color: null, notes: null, description: null, ...extra };
}

describe("classifyDayWeather", () => {
  it.each([
    [-3, "freezing"],
    [2, "freezing"],
    [5, "cold"],
    [12, "cool"],
    [20, "mild"],
    [30, "hot"],
  ] as const)("puts a %s°C high in the %s band", (highC, band) => {
    expect(classifyDayWeather(day({ highC })).temp).toBe(band);
  });

  it("treats rain codes and a high rain chance as wet", () => {
    expect(classifyDayWeather(rainy).wet).toBe(true);
    expect(
      classifyDayWeather(day({ precipitationChancePercent: 60 })).wet,
    ).toBe(true);
    expect(
      classifyDayWeather(day({ weatherCode: 95, precipitationChancePercent: null }))
        .wet,
    ).toBe(true);
    expect(classifyDayWeather(day()).wet).toBe(false);
  });

  it("separates snow from rain", () => {
    const snow = classifyDayWeather(day({ weatherCode: 73, highC: 0 }));
    expect(snow.snow).toBe(true);
    expect(snow.wet).toBe(false);
  });
});

describe("dayWeatherRules", () => {
  it("adds layers on cold days", () => {
    const rules = dayWeatherRules(day({ highC: 6 })).join("\n");
    expect(rules).toMatch(/add layers/i);
    expect(rules).toMatch(/outerwear/i);
    expect(rules).not.toMatch(/suede/i);
  });

  it("asks for warm shoes and accessories near freezing", () => {
    const rules = dayWeatherRules(day({ highC: -1 })).join("\n");
    expect(rules).toMatch(/add layers/i);
    expect(rules).toMatch(/scarf or hat/i);
  });

  it("asks for a light layer on cool days", () => {
    expect(dayWeatherRules(day({ highC: 14 })).join("\n")).toMatch(
      /light layer/i,
    );
  });

  it("avoids suede and light colors on rainy days", () => {
    const rules = dayWeatherRules(rainy).join("\n");
    expect(rules).toMatch(/avoid suede/i);
    expect(rules).toMatch(/light colors/i);
    expect(rules).toMatch(/water-resistant/i);
  });

  it("keeps hot days light and has no rules for a mild dry day", () => {
    expect(dayWeatherRules(day({ highC: 31 })).join("\n")).toMatch(
      /skip outerwear/i,
    );
    expect(dayWeatherRules(day())).toEqual([]);
  });
});

describe("dayWeatherPrompt", () => {
  it("names the day, place, forecast in °F, and rules", () => {
    const prompt = dayWeatherPrompt(
      day({ highC: 8, lowC: 3, weatherCode: 63, condition: "Rain", precipitationChancePercent: 80 }),
      "Wednesday",
      "Chicago, IL",
    );
    expect(prompt).toContain(
      "Forecast for Wednesday in Chicago, IL: Rain, high 46°F / low 37°F, 80% chance of precipitation.",
    );
    expect(prompt).toMatch(/Weather rules for this day:\n- Cold day/);
    expect(prompt).toMatch(/- Wet day: avoid suede/);
  });

  it("omits the rules header on a day with none", () => {
    expect(dayWeatherPrompt(day(), "Friday", "NYC")).not.toMatch(/rules/);
  });
});

describe("weatherSafeGarments", () => {
  const closet = [
    garment("t1", "tops", "White tee"),
    garment("b1", "bottoms", "Dark jeans"),
    garment("s1", "shoes", "Tan suede chelsea boots"),
    garment("s2", "shoes", "Leather boots"),
    garment("o1", "outerwear", "Jacket", { description: "Nubuck trucker" }),
  ];

  it("drops suede and nubuck on rainy days", () => {
    const ids = weatherSafeGarments(closet, rainy).map((g) => g.id);
    expect(ids).toEqual(["t1", "b1", "s2"]);
  });

  it("drops them on snowy days too", () => {
    const ids = weatherSafeGarments(closet, day({ weatherCode: 75 })).map(
      (g) => g.id,
    );
    expect(ids).not.toContain("s1");
  });

  it("keeps everything on dry days or with no forecast", () => {
    expect(weatherSafeGarments(closet, day())).toBe(closet);
    expect(weatherSafeGarments(closet, undefined)).toBe(closet);
  });

  it("keeps suede when it is the only way to finish a look", () => {
    const onlySuedeShoes = closet.filter((g) => g.id !== "s2");
    expect(weatherSafeGarments(onlySuedeShoes, rainy)).toBe(onlySuedeShoes);
  });
});

describe("formatting", () => {
  it("formats the strip high and the day line in °F", () => {
    expect(formatDayHigh(day({ highC: 9 }))).toBe("48°");
    expect(formatDayWeatherLine("New York, NY", rainy)).toBe(
      "New York, NY · rain · 68° / 54° · 80% rain",
    );
    expect(
      formatDayWeatherLine("NYC", day({ precipitationChancePercent: null })),
    ).toBe("NYC · partly cloudy · 68° / 54°");
  });
});

describe("forecastChangeReason", () => {
  it("does not flag without a planned or current forecast", () => {
    expect(forecastChangeReason(undefined, rainy)).toBeNull();
    expect(forecastChangeReason(day(), undefined)).toBeNull();
  });

  it("does not flag small changes", () => {
    expect(forecastChangeReason(day(), day({ highC: 22, lowC: 10 }))).toBeNull();
  });

  it("flags rain appearing", () => {
    expect(forecastChangeReason(day(), { ...rainy, highC: 20 })).toBe(
      "Forecast changed since this was planned: rain is now in the forecast.",
    );
  });

  it("flags rain clearing", () => {
    expect(forecastChangeReason({ ...rainy, highC: 20 }, day())).toMatch(
      /the rain has cleared/,
    );
  });

  it("flags snow over rain", () => {
    expect(
      forecastChangeReason(day({ highC: 3 }), day({ highC: 2, weatherCode: 73 })),
    ).toMatch(/snow is now in the forecast/);
  });

  it("flags a colder band with the new and planned highs", () => {
    expect(forecastChangeReason(day({ highC: 14 }), day({ highC: 7 }))).toBe(
      "Forecast changed since this was planned: it's colder (high 45°, planned for 57°).",
    );
  });

  it("ignores a tiny wobble across a band edge", () => {
    expect(
      forecastChangeReason(day({ highC: 10.2 }), day({ highC: 9.6 })),
    ).toBeNull();
  });

  it("flags a big shift inside one band", () => {
    expect(forecastChangeReason(day({ highC: 18 }), day({ highC: 25 }))).toMatch(
      /it's warmer \(high 77°, planned for 64°\)/,
    );
  });

  it("joins rain and temperature changes", () => {
    expect(
      forecastChangeReason(day({ highC: 14 }), { ...rainy, highC: 6 }),
    ).toBe(
      "Forecast changed since this was planned: rain is now in the forecast and it's colder (high 43°, planned for 57°).",
    );
  });
});
