import { z } from "zod";

import type { DayForecast } from "@/lib/ai/weather/fetch-weather";
import { getSql, requireSql } from "@/lib/db";
import { addDaysIso } from "@/lib/time/product-timezone";

/**
 * The forecast each Fit was planned against, stored in
 * `weekly_outfit_plans.step1_raw.plannedWeather` keyed by sort_order
 * ("0"–"6"). Today compares it with the live forecast to flag days whose
 * weather changed; nothing re-plans automatically.
 */
export type PlannedWeather = Record<string, DayForecast>;

const dayForecastSchema = z.object({
  date: z.string(),
  highC: z.number(),
  lowC: z.number(),
  precipitationChancePercent: z.number().nullable(),
  weatherCode: z.number(),
  condition: z.string(),
});

const plannedWeatherSchema = z.record(
  z.string().regex(/^[0-6]$/),
  dayForecastSchema,
);

/** `plannedWeather` from a stored `step1_raw`; anything malformed reads as none. */
export function parsePlannedWeather(step1Raw: unknown): PlannedWeather {
  if (!step1Raw || typeof step1Raw !== "object") return {};
  const parsed = plannedWeatherSchema.safeParse(
    (step1Raw as { plannedWeather?: unknown }).plannedWeather,
  );
  return parsed.success ? parsed.data : {};
}

/** Planned forecast for each look whose day had one. */
export function plannedWeatherForLooks(
  weekStartIso: string,
  sortOrders: readonly number[],
  forecastByDay: ReadonlyMap<string, DayForecast>,
): PlannedWeather {
  const planned: PlannedWeather = {};
  for (const sortOrder of sortOrders) {
    const day = forecastByDay.get(addDaysIso(weekStartIso, sortOrder));
    if (day) planned[String(sortOrder)] = day;
  }
  return planned;
}

/** Replace (or clear, when `day` is undefined) one day's planned forecast. */
export async function savePlannedDayWeather(
  planId: string,
  sortOrder: number,
  day: DayForecast | undefined,
): Promise<void> {
  const sql = requireSql();
  const key = String(sortOrder);
  if (day) {
    await sql`
      UPDATE weekly_outfit_plans
      SET step1_raw = jsonb_set(
        coalesce(step1_raw, '{}'::jsonb),
        '{plannedWeather}',
        coalesce(step1_raw->'plannedWeather', '{}'::jsonb)
          || jsonb_build_object(${key}::text, ${JSON.stringify(day)}::jsonb)
      )
      WHERE id = ${planId}
    `;
    return;
  }
  await sql`
    UPDATE weekly_outfit_plans
    SET step1_raw = jsonb_set(
      coalesce(step1_raw, '{}'::jsonb),
      '{plannedWeather}',
      coalesce(step1_raw->'plannedWeather', '{}'::jsonb) - ${key}::text
    )
    WHERE id = ${planId}
  `;
}

const rawRowSchema = z.object({ step1_raw: z.unknown() });

/** This week's planned forecasts keyed by calendar day (YYYY-MM-DD). */
export async function loadPlannedWeatherByDay(
  userId: string,
  weekStartIso: string,
): Promise<Map<string, DayForecast>> {
  const sql = getSql();
  const byDay = new Map<string, DayForecast>();
  if (!sql || !userId) return byDay;

  try {
    const rows = await sql`
      SELECT step1_raw
      FROM weekly_outfit_plans
      WHERE user_id = ${userId}
        AND week_start = ${weekStartIso}::date
        AND status IN ('completed', 'draft')
      LIMIT 1
    `;
    const parsed = z.array(rawRowSchema).safeParse(rows);
    const raw = parsed.success ? parsed.data[0]?.step1_raw : undefined;
    for (const [sortOrder, day] of Object.entries(parsePlannedWeather(raw))) {
      byDay.set(addDaysIso(weekStartIso, Number(sortOrder)), day);
    }
  } catch (e) {
    console.error("[outfits] loadPlannedWeatherByDay failed", e);
  }
  return byDay;
}
