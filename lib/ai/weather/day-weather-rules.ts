import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import { celsiusToFahrenheit } from "@/lib/ai/weather/format-today-line";
import { catalogCanFormLook } from "@/lib/outfits/look-composition";

/** Daily-high bands that change what a look needs. */
export type TempBand = "freezing" | "cold" | "cool" | "mild" | "hot";

export type DayWeatherClass = {
  temp: TempBand;
  /** Rain, drizzle, showers, or thunderstorms likely. */
  wet: boolean;
  snow: boolean;
};

/** Rain chance at or above this counts as a rainy day. */
export const WET_CHANCE_PERCENT = 50;

/** A shift in the daily high this large is worth flagging on its own (~11°F). */
export const HIGH_SHIFT_FLAG_C = 6;

/** A band change smaller than this (~4°F) is noise near a band edge. */
const BAND_CHANGE_MIN_SHIFT_C = 2;

/** Water-sensitive materials kept out of rainy and snowy days. */
const WATER_SENSITIVE = /\b(suede|nubuck)\b/i;

function tempBand(highC: number): TempBand {
  if (highC <= 2) return "freezing";
  if (highC < 10) return "cold";
  if (highC < 17) return "cool";
  if (highC < 27) return "mild";
  return "hot";
}

function isWetCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  );
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

export function classifyDayWeather(day: DayForecast): DayWeatherClass {
  const snow = isSnowCode(day.weatherCode);
  const wet =
    !snow &&
    (isWetCode(day.weatherCode) ||
      (day.precipitationChancePercent ?? 0) >= WET_CHANCE_PERCENT);
  return { temp: tempBand(day.highC), wet, snow };
}

/** Styling rules for one day, in the order the stylist should weigh them. */
export function dayWeatherRules(day: DayForecast): string[] {
  const { temp, wet, snow } = classifyDayWeather(day);
  const rules: string[] = [];

  if (temp === "freezing" || temp === "cold") {
    rules.push(
      "Cold day: add layers. Include a warm outerwear piece (coat, parka, puffer) and, if the closet allows, a second top such as a sweater over a shirt.",
    );
  }
  if (temp === "freezing") {
    rules.push(
      "Near freezing: choose closed, warm shoes and add a scarf or hat if the closet has one.",
    );
  }
  if (temp === "cool") {
    rules.push(
      "Cool day: add a light layer, such as a jacket, overshirt, or cardigan.",
    );
  }
  if (temp === "hot") {
    rules.push(
      "Hot day: keep it light and breathable. Skip outerwear and heavy knits.",
    );
  }
  if (wet || snow) {
    rules.push(
      "Wet day: avoid suede and nubuck, especially shoes.",
      "Wet day: avoid white and very light colors that show splashes; favor darker tones.",
      snow
        ? "Snow: pick closed shoes with grip and a water-resistant outer layer."
        : "A water-resistant outer layer (trench, shell, rain jacket) is a plus.",
    );
  }
  return rules;
}

/** "Rain, high 48°F / low 39°F, 80% chance of precipitation" */
function describeForecast(day: DayForecast): string {
  const chance =
    day.precipitationChancePercent === null
      ? ""
      : `, ${day.precipitationChancePercent}% chance of precipitation`;
  return `${day.condition}, high ${celsiusToFahrenheit(day.highC)}°F / low ${celsiusToFahrenheit(day.lowC)}°F${chance}`;
}

/** Forecast and rules for one day, for the step-1 prompt. */
export function dayWeatherPrompt(
  day: DayForecast,
  weekday: string,
  location: string,
): string {
  const rules = dayWeatherRules(day);
  const ruleLines =
    rules.length > 0
      ? `\nWeather rules for this day:\n${rules.map((r) => `- ${r}`).join("\n")}`
      : "";
  return `Forecast for ${weekday} in ${location}: ${describeForecast(day)}.${ruleLines}`;
}

function mentionsWaterSensitive(g: CatalogGarment): boolean {
  return [g.name, g.description, g.notes].some(
    (text) => text != null && WATER_SENSITIVE.test(text),
  );
}

/**
 * Drop suede and nubuck on rainy or snowy days. If that leaves no wearable
 * look, keep the closet as is and let the prompt rules steer instead.
 */
export function weatherSafeGarments(
  garments: CatalogGarment[],
  day: DayForecast | undefined,
): CatalogGarment[] {
  if (!day) return garments;
  const { wet, snow } = classifyDayWeather(day);
  if (!wet && !snow) return garments;
  const safe = garments.filter((g) => !mentionsWaterSensitive(g));
  if (safe.length === garments.length) return garments;
  return catalogCanFormLook(safe) ? safe : garments;
}

/** Strip label, e.g. "48°". */
export function formatDayHigh(day: DayForecast): string {
  return `${celsiusToFahrenheit(day.highC)}°`;
}

/** Day line, e.g. "New York, NY · rain · 48° / 39° · 80% rain". */
export function formatDayWeatherLine(place: string, day: DayForecast): string {
  const parts = [
    place,
    day.condition.toLowerCase(),
    `${celsiusToFahrenheit(day.highC)}° / ${celsiusToFahrenheit(day.lowC)}°`,
  ];
  if (day.precipitationChancePercent !== null) {
    parts.push(`${day.precipitationChancePercent}% rain`);
  }
  return parts.join(" · ");
}

/**
 * Why a planned day no longer matches its forecast, or null when it still
 * does. Changes that would alter the look count: rain or snow appearing or
 * clearing, the high crossing a band (by more than edge noise), or the high
 * moving by `HIGH_SHIFT_FLAG_C` or more. Days are flagged only; the plan is not
 * rewritten.
 */
export function forecastChangeReason(
  planned: DayForecast | undefined,
  current: DayForecast | undefined,
): string | null {
  if (!planned || !current) return null;
  const was = classifyDayWeather(planned);
  const now = classifyDayWeather(current);
  const reasons: string[] = [];

  const wasWet = was.wet || was.snow;
  const nowWet = now.wet || now.snow;
  if (now.snow && !was.snow) reasons.push("snow is now in the forecast");
  else if (nowWet && !wasWet) reasons.push("rain is now in the forecast");
  else if (!nowWet && wasWet) reasons.push("the rain has cleared");

  const shift = current.highC - planned.highC;
  const bandChanged =
    now.temp !== was.temp && Math.abs(shift) >= BAND_CHANGE_MIN_SHIFT_C;
  if (bandChanged || Math.abs(shift) >= HIGH_SHIFT_FLAG_C) {
    reasons.push(
      `it's ${shift < 0 ? "colder" : "warmer"} (high ${celsiusToFahrenheit(current.highC)}°, planned for ${celsiusToFahrenheit(planned.highC)}°)`,
    );
  }

  if (reasons.length === 0) return null;
  const joined = reasons.join(" and ");
  return `Forecast changed since this was planned: ${joined}.`;
}
