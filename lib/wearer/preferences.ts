import { getSql, requireSql } from "@/lib/db";
import {
  clampRepeatWindowDays,
  DEFAULT_REPEAT_WINDOW_DAYS,
} from "@/lib/outfits/repeat-guard";
import { logServerError } from "@/lib/server/safe-client-error";

const LOCATION_MAX = 120;

export async function getWearerLocation(userId: string): Promise<string | null> {
  const sql = getSql();
  if (!sql || !userId) return null;
  try {
    const rows = (await sql`
      SELECT location
      FROM wearer_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `) as { location: string | null }[];
    const location = rows[0]?.location?.trim() || null;
    return location;
  } catch (e) {
    console.error("[wearer] getWearerLocation failed", e);
    return null;
  }
}

export async function saveWearerLocation(
  userId: string,
  location: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }
  const trimmed = location.trim().slice(0, LOCATION_MAX);
  try {
    const sql = requireSql();
    if (!trimmed) {
      await sql`
        INSERT INTO wearer_preferences (user_id, location, updated_at)
        VALUES (${userId}, NULL, now())
        ON CONFLICT (user_id) DO UPDATE SET
          location = NULL,
          updated_at = now()
      `;
      return { ok: true };
    }
    await sql`
      INSERT INTO wearer_preferences (user_id, location, updated_at)
      VALUES (${userId}, ${trimmed}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        location = EXCLUDED.location,
        updated_at = now()
    `;
    return { ok: true };
  } catch (e) {
    logServerError("saveWearerLocation", e);
    return { ok: false, message: "Could not save location. Try again." };
  }
}

/** Days before Plan my week may suggest a worn Outfit again (default 7). */
export async function getRepeatWindowDays(userId: string): Promise<number> {
  const sql = getSql();
  if (!sql || !userId) return DEFAULT_REPEAT_WINDOW_DAYS;
  try {
    const rows = (await sql`
      SELECT repeat_window_days
      FROM wearer_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `) as { repeat_window_days: number | null }[];
    const stored = rows[0]?.repeat_window_days;
    return stored == null
      ? DEFAULT_REPEAT_WINDOW_DAYS
      : clampRepeatWindowDays(stored);
  } catch (e) {
    console.error("[wearer] getRepeatWindowDays failed", e);
    return DEFAULT_REPEAT_WINDOW_DAYS;
  }
}

export async function saveRepeatWindowDays(
  userId: string,
  days: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }
  const value = clampRepeatWindowDays(days);
  try {
    const sql = requireSql();
    await sql`
      INSERT INTO wearer_preferences (user_id, repeat_window_days, updated_at)
      VALUES (${userId}, ${value}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        repeat_window_days = EXCLUDED.repeat_window_days,
        updated_at = now()
    `;
    return { ok: true };
  } catch (e) {
    logServerError("saveRepeatWindowDays", e);
    return { ok: false, message: "Could not save. Try again." };
  }
}
