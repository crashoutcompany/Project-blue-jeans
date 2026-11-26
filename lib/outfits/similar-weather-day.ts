import { classifyDayWeather } from "@/lib/ai/weather/day-weather-rules";
import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import { celsiusToFahrenheit } from "@/lib/ai/weather/format-today-line";
import { addDaysIso } from "@/lib/time/product-timezone";

/** How far back Today looks for a worn day with weather like today's. */
export const SIMILAR_DAY_LOOKBACK_DAYS = 60;

/**
 * Two days dress alike when they share the weather-aware plan's classes:
 * the same daily-high band and the same rain / snow call.
 */
export function isSimilarWeather(a: DayForecast, b: DayForecast): boolean {
  const x = classifyDayWeather(a);
  const y = classifyDayWeather(b);
  return x.temp === y.temp && x.wet === y.wet && x.snow === y.snow;
}

/** First day the similar-weather lookup reads, `lookbackDays` before today. */
export function similarDayLookbackStartIso(
  todayIso: string,
  lookbackDays = SIMILAR_DAY_LOOKBACK_DAYS,
): string {
  return addDaysIso(todayIso, -lookbackDays);
}

/**
 * The most recent day before today the Wearer confirmed with "Wore this"
 * whose weather matched today's. Similar means weather, not weekday. Null
 * without today's forecast or when no worn day matches.
 */
export function findLastSimilarWornDay<
  T extends { wornOn: string; worn: boolean },
>(params: {
  todayIso: string;
  forecastByDay: ReadonlyMap<string, DayForecast>;
  outfits: Iterable<T>;
}): { outfit: T; weather: DayForecast } | null {
  const today = params.forecastByDay.get(params.todayIso);
  if (!today) return null;
  let best: { outfit: T; weather: DayForecast } | null = null;
  for (const outfit of params.outfits) {
    if (!outfit.worn || outfit.wornOn >= params.todayIso) continue;
    if (best && outfit.wornOn <= best.outfit.wornOn) continue;
    const weather = params.forecastByDay.get(outfit.wornOn);
    if (!weather || !isSimilarWeather(today, weather)) continue;
    best = { outfit, weather };
  }
  return best;
}

/** Short weather label for a past day, e.g. "rain · 48° / 39°". */
export function formatSimilarDayWeather(day: DayForecast): string {
  return `${day.condition.toLowerCase()} · ${celsiusToFahrenheit(day.highC)}° / ${celsiusToFahrenheit(day.lowC)}°`;
}
