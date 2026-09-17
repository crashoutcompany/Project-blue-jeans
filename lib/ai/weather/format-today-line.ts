import type { WeatherSnapshot } from "@/lib/ai/weather/fetch-weather";

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

/** Quiet Today line: "New York, NY · 54° rain". */
export function formatTodayWeatherLine(
  place: string,
  snapshot: WeatherSnapshot | null,
): string {
  const city = place.trim() || "New York, NY";
  if (!snapshot || !snapshot.ok) return city;
  const tempF = celsiusToFahrenheit(snapshot.current.temperatureC);
  const condition = snapshot.current.condition.toLowerCase();
  return `${city} · ${tempF}° ${condition}`;
}
