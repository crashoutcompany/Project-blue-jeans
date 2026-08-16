/** Fixed product timezone for “today” and calendar weeks (see CONTEXT.md). */
export const PRODUCT_TIME_ZONE = "America/New_York";

/**
 * Calendar date (YYYY-MM-DD) in the product timezone.
 */
export function productTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Sunday (inclusive) of the product calendar week containing `isoDate` (YYYY-MM-DD).
 */
export function sundayWeekStartIso(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid iso date: ${isoDate}`);
  }
  // Noon UTC avoids DST edge cases when shifting calendar days.
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: PRODUCT_TIME_ZONE,
    weekday: "short",
  }).format(utc);
  const sunOffset: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const back = sunOffset[weekday] ?? 0;
  utc.setUTCDate(utc.getUTCDate() - back);
  return utc.toISOString().slice(0, 10);
}

/**
 * Add days to a YYYY-MM-DD string (UTC noon arithmetic).
 */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

const PRODUCT_DATE_LONG = new Intl.DateTimeFormat("en-US", {
  timeZone: PRODUCT_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});

/**
 * Long product-timezone date for home hero, e.g. "Monday, August 10".
 */
export function formatProductDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid iso date: ${isoDate}`);
  }
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return PRODUCT_DATE_LONG.format(utc);
}
