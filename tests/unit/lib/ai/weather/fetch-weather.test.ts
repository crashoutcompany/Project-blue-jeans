import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchDailyForecast,
  fetchWeather,
} from "@/lib/ai/weather/fetch-weather";

describe("fetchWeather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns forecast for a geocoded city", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        if (href.includes("geocoding-api.open-meteo.com")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: "Chicago",
                  admin1: "Illinois",
                  country: "United States",
                  latitude: 41.88,
                  longitude: -87.63,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (href.includes("api.open-meteo.com")) {
          return new Response(
            JSON.stringify({
              timezone: "America/Chicago",
              current: {
                temperature_2m: 18,
                apparent_temperature: 16,
                relative_humidity_2m: 55,
                precipitation: 0,
                weather_code: 2,
                wind_speed_10m: 12,
              },
              daily: {
                temperature_2m_max: [22],
                temperature_2m_min: [12],
                precipitation_probability_max: [10],
                weather_code: [2],
              },
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${href}`);
      }),
    );

    const result = await fetchWeather({ location: "Chicago" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location).toContain("Chicago");
      expect(result.current.temperatureC).toBe(18);
      expect(result.today.highC).toBe(22);
      expect(result.current.condition).toBe("Partly cloudy");
    }
  });

  it("returns error when geocoding finds no place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      ),
    );

    const result = await fetchWeather({ location: "Nowhereville XYZ" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No location found");
    }
  });

  it("accepts coordinates directly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        expect(href).toContain("latitude=40.71");
        expect(href).toContain("longitude=-74.01");
        return new Response(
          JSON.stringify({
            timezone: "America/New_York",
            current: {
              temperature_2m: 20,
              apparent_temperature: 19,
              relative_humidity_2m: 60,
              precipitation: 0,
              weather_code: 0,
              wind_speed_10m: 8,
            },
            daily: {
              temperature_2m_max: [24],
              temperature_2m_min: [16],
              precipitation_probability_max: [5],
              weather_code: [0],
            },
          }),
          { status: 200 },
        );
      }),
    );

    const result = await fetchWeather({ latitude: 40.71, longitude: -74.01 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.current.condition).toBe("Clear sky");
    }
  });
});

describe("fetchDailyForecast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns one entry per forecast day and skips days without temperatures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        expect(href).toContain("forecast_days=7");
        expect(href).not.toContain("current=");
        return new Response(
          JSON.stringify({
            timezone: "America/New_York",
            daily: {
              time: ["2026-11-09", "2026-11-10", "2026-11-11"],
              temperature_2m_max: [12, null, 4],
              temperature_2m_min: [6, 5, -1],
              precipitation_probability_max: [20, 30, null],
              weather_code: [3, 61, 73],
            },
          }),
          { status: 200 },
        );
      }),
    );

    const result = await fetchDailyForecast({ latitude: 40.71, longitude: -74.01 });
    expect(result).toEqual({
      ok: true,
      location: "40.71, -74.01",
      timezone: "America/New_York",
      days: [
        {
          date: "2026-11-09",
          highC: 12,
          lowC: 6,
          precipitationChancePercent: 20,
          weatherCode: 3,
          condition: "Partly cloudy",
        },
        {
          date: "2026-11-11",
          highC: 4,
          lowC: -1,
          precipitationChancePercent: null,
          weatherCode: 73,
          condition: "Snow",
        },
      ],
    });
  });

  it("fails soft on an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    const result = await fetchDailyForecast({ latitude: 1, longitude: 1 });
    expect(result).toEqual({ ok: false, error: "Weather forecast failed (503)." });
  });
});
