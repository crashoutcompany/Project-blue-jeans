import { describe, expect, it } from "vitest";

import { formatTodayWeatherLine } from "@/lib/ai/weather/format-today-line";

describe("formatTodayWeatherLine", () => {
  it("returns the city when weather is missing", () => {
    expect(formatTodayWeatherLine("Austin, TX", null)).toBe("Austin, TX");
  });

  it("appends Fahrenheit and a short condition", () => {
    expect(
      formatTodayWeatherLine("New York, NY", {
        ok: true,
        location: "New York, NY",
        latitude: 0,
        longitude: 0,
        timezone: "America/New_York",
        current: {
          temperatureC: 12.2,
          apparentTemperatureC: 11,
          humidityPercent: 80,
          precipitationMm: 1,
          windSpeedKmh: 10,
          condition: "Rain",
        },
        today: {
          highC: 14,
          lowC: 8,
          precipitationChancePercent: 70,
          condition: "Rain",
        },
      }),
    ).toBe("New York, NY · 54° rain");
  });
});
