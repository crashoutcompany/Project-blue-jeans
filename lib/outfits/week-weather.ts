import {
  classifyDayWeather,
  forecastChangeReason,
  formatDayHigh,
  formatDayWeatherLine,
} from "@/lib/ai/weather/day-weather-rules";
import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import { addDaysIso } from "@/lib/time/product-timezone";

/** One day's weather beside its planned look on Today. */
export type TodayDayWeather = {
  /** Week strip label, e.g. "48°". */
  high: string;
  /** Rain or snow likely. */
  wet: boolean;
  /** Under the date, e.g. "New York, NY · rain · 48° / 39° · 80% rain". */
  line: string;
  /** Set when the day's Fit was planned for different weather. */
  changed?: string;
};

/**
 * Weather for today and later days of the week. Days whose Fit was planned
 * against a forecast that has since changed carry `changed`; the plan itself
 * is left alone. A missing forecast leaves the day out.
 */
export function buildWeekWeather(params: {
  todayIso: string;
  weekStartIso: string;
  place: string;
  forecastByDay: ReadonlyMap<string, DayForecast>;
  plannedByDay: ReadonlyMap<string, DayForecast>;
  /** Days showing a Fit (an approved Outfit is the Wearer's call). */
  fitDays: ReadonlySet<string>;
}): Record<string, TodayDayWeather> {
  const week: Record<string, TodayDayWeather> = {};
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso(params.weekStartIso, i);
    if (iso < params.todayIso) continue;
    const day = params.forecastByDay.get(iso);
    if (!day) continue;
    const { wet, snow } = classifyDayWeather(day);
    const changed = params.fitDays.has(iso)
      ? forecastChangeReason(params.plannedByDay.get(iso), day)
      : null;
    week[iso] = {
      high: formatDayHigh(day),
      wet: wet || snow,
      line: formatDayWeatherLine(params.place, day),
      ...(changed ? { changed } : {}),
    };
  }
  return week;
}
