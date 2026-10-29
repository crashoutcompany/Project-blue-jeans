import { z } from "zod";

import { getSql } from "@/lib/db";
import { addDaysIso } from "@/lib/time/product-timezone";

/**
 * A day "Plan my week" or "Regenerate this day" could not plan. Stored in
 * `weekly_outfit_plans.step1_raw.failedDays` so the planned days still save
 * and Today can show the error on just the failed day.
 */
export type FailedPlanDay = {
  sortOrder: number;
  /** User-facing, e.g. "Couldn't plan Friday. Try again in a moment." */
  message: string;
};

const failedPlanDaySchema = z.object({
  sortOrder: z.number().int().min(0).max(6),
  message: z.string(),
});

const failedDaysSchema = z.array(failedPlanDaySchema);

/** `failedDays` from a stored `step1_raw`; anything malformed reads as none. */
export function parseFailedPlanDays(step1Raw: unknown): FailedPlanDay[] {
  if (!step1Raw || typeof step1Raw !== "object") return [];
  const parsed = failedDaysSchema.safeParse(
    (step1Raw as { failedDays?: unknown }).failedDays,
  );
  return parsed.success ? parsed.data : [];
}

/** Replace (or clear, when `message` is null) one day's failure. */
export function withFailedPlanDay(
  failedDays: readonly FailedPlanDay[],
  sortOrder: number,
  message: string | null,
): FailedPlanDay[] {
  const rest = failedDays.filter((d) => d.sortOrder !== sortOrder);
  if (message === null) return rest;
  return [...rest, { sortOrder, message }].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

const failedDaysRowSchema = z.object({ step1_raw: z.unknown() });

/** Failed days of this week's plan, keyed by calendar day (YYYY-MM-DD). */
export async function loadFailedPlanDaysByDay(
  userId: string,
  weekStartIso: string,
): Promise<Map<string, string>> {
  const sql = getSql();
  const byDay = new Map<string, string>();
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
    const parsed = z.array(failedDaysRowSchema).safeParse(rows);
    const raw = parsed.success ? parsed.data[0]?.step1_raw : undefined;
    for (const day of parseFailedPlanDays(raw)) {
      byDay.set(addDaysIso(weekStartIso, day.sortOrder), day.message);
    }
  } catch (e) {
    console.error("[outfits] loadFailedPlanDaysByDay failed", e);
  }
  return byDay;
}
