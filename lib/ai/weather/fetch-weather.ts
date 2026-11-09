/** Human-readable condition from Open-Meteo WMO weather codes. */
function wmoCondition(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

export type WeatherSnapshot =
  | {
      ok: true;
      location: string;
      latitude: number;
      longitude: number;
      timezone: string;
      current: {
        temperatureC: number;
        apparentTemperatureC: number;
        humidityPercent: number;
        precipitationMm: number;
        windSpeedKmh: number;
        condition: string;
      };
      today: {
        highC: number;
        lowC: number;
        precipitationChancePercent: number | null;
        condition: string;
      };
    }
  | { ok: false; error: string };

type GeocodeResponse = {
  results?: {
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }[];
};

type ForecastResponse = {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
  };
};

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

async function geocodeLocation(
  location: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; label: string; latitude: number; longitude: number }
  | { ok: false; error: string }
> {
  const name = location.trim();
  if (!name) {
    return { ok: false, error: "Location name is required." };
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal });
  if (!res.ok) {
    return { ok: false, error: `Geocoding failed (${res.status}).` };
  }

  const data = (await res.json()) as GeocodeResponse;
  const hit = data.results?.[0];
  if (!hit) {
    return { ok: false, error: `No location found for "${name}".` };
  }

  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  return {
    ok: true,
    label: parts.join(", "),
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
}

export type FetchWeatherInput =
  | { location: string; latitude?: never; longitude?: never }
  | { location?: never; latitude: number; longitude: number };

type ResolvedPlace =
  | { ok: true; label: string; latitude: number; longitude: number }
  | { ok: false; error: string };

async function resolvePlace(
  input: FetchWeatherInput,
  signal?: AbortSignal,
): Promise<ResolvedPlace> {
  if ("location" in input && input.location !== undefined) {
    return geocodeLocation(input.location, signal);
  }
  const { latitude, longitude } = input;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, error: "Invalid latitude or longitude." };
  }
  return {
    ok: true,
    label: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    latitude,
    longitude,
  };
}

/** Current conditions and today's forecast via Open-Meteo (no API key). */
export async function fetchWeather(
  input: FetchWeatherInput,
  options?: { abortSignal?: AbortSignal },
): Promise<WeatherSnapshot> {
  const signal = options?.abortSignal;

  const place = await resolvePlace(input, signal);
  if (!place.ok) return place;
  const { label, latitude, longitude } = place;

  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url, { signal });
  if (!res.ok) {
    return { ok: false, error: `Weather forecast failed (${res.status}).` };
  }

  const data = (await res.json()) as ForecastResponse;
  const current = data.current;
  const daily = data.daily;

  if (!current || !daily?.temperature_2m_max?.[0] || !daily.temperature_2m_min?.[0]) {
    return { ok: false, error: "Weather data was incomplete." };
  }

  const currentCode = current.weather_code ?? 0;
  const todayCode = daily.weather_code?.[0] ?? currentCode;

  return {
    ok: true,
    location: label,
    latitude,
    longitude,
    timezone: data.timezone ?? "UTC",
    current: {
      temperatureC: current.temperature_2m ?? 0,
      apparentTemperatureC: current.apparent_temperature ?? current.temperature_2m ?? 0,
      humidityPercent: current.relative_humidity_2m ?? 0,
      precipitationMm: current.precipitation ?? 0,
      windSpeedKmh: current.wind_speed_10m ?? 0,
      condition: wmoCondition(currentCode),
    },
    today: {
      highC: daily.temperature_2m_max[0]!,
      lowC: daily.temperature_2m_min[0]!,
      precipitationChancePercent: daily.precipitation_probability_max?.[0] ?? null,
      condition: wmoCondition(todayCode),
    },
  };
}

/** One calendar day of the forecast, in the place's local timezone. */
export type DayForecast = {
  /** YYYY-MM-DD */
  date: string;
  highC: number;
  lowC: number;
  precipitationChancePercent: number | null;
  /** Open-Meteo WMO weather code. */
  weatherCode: number;
  condition: string;
};

export type DailyForecast =
  | { ok: true; location: string; timezone: string; days: DayForecast[] }
  | { ok: false; error: string };

type DailyForecastResponse = {
  timezone?: string;
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    weather_code?: (number | null)[];
  };
};

/** Daily highs, lows, and rain chance for the next `days` days via Open-Meteo. */
export async function fetchDailyForecast(
  input: FetchWeatherInput,
  options?: { abortSignal?: AbortSignal; days?: number },
): Promise<DailyForecast> {
  const signal = options?.abortSignal;
  const forecastDays = Math.min(Math.max(options?.days ?? 7, 1), 16);

  const place = await resolvePlace(input, signal);
  if (!place.ok) return place;

  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(forecastDays));

  const res = await fetch(url, { signal });
  if (!res.ok) {
    return { ok: false, error: `Weather forecast failed (${res.status}).` };
  }

  const data = (await res.json()) as DailyForecastResponse;
  const daily = data.daily;
  const days: DayForecast[] = [];
  (daily?.time ?? []).forEach((date, i) => {
    const highC = daily?.temperature_2m_max?.[i];
    const lowC = daily?.temperature_2m_min?.[i];
    // A day without temperatures is no use for dressing; skip it.
    if (typeof highC !== "number" || typeof lowC !== "number") return;
    const code = daily?.weather_code?.[i] ?? 0;
    days.push({
      date,
      highC,
      lowC,
      precipitationChancePercent:
        daily?.precipitation_probability_max?.[i] ?? null,
      weatherCode: code,
      condition: wmoCondition(code),
    });
  });

  if (days.length === 0) {
    return { ok: false, error: "Weather data was incomplete." };
  }
  return {
    ok: true,
    location: place.label,
    timezone: data.timezone ?? "UTC",
    days,
  };
}
