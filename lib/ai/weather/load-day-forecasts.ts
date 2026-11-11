import {
  fetchDailyForecast,
  type DayForecast,
} from "@/lib/ai/weather/fetch-weather";

const FORECAST_TIMEOUT_MS = 5_000;

/**
 * Next 7 days of forecast keyed by YYYY-MM-DD. Fails soft: any error or a
 * slow response reads as an empty map, and callers plan or render without
 * weather.
 */
export async function loadDayForecasts(
  location: string,
): Promise<Map<string, DayForecast>> {
  const byDay = new Map<string, DayForecast>();
  try {
    const forecast = await fetchDailyForecast(
      { location },
      { abortSignal: AbortSignal.timeout(FORECAST_TIMEOUT_MS), days: 7 },
    );
    if (!forecast.ok) {
      console.error("[weather] daily forecast unavailable", forecast.error);
      return byDay;
    }
    for (const day of forecast.days) byDay.set(day.date, day);
  } catch (e) {
    console.error("[weather] daily forecast failed", e);
  }
  return byDay;
}
