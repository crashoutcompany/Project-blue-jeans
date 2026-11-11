import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import { garmentSetKey } from "@/lib/outfits/garment-set-key";
import { addDaysIso } from "@/lib/time/product-timezone";

/** Days before Plan my week may suggest a worn Outfit again. */
export const DEFAULT_REPEAT_WINDOW_DAYS = 7;
/** Matches the CHECK on wearer_preferences.repeat_window_days. */
export const MAX_REPEAT_WINDOW_DAYS = 30;

/** One confirmed "Wore this" day. */
export type RecentWear = {
  wornOn: string;
  garmentIds: string[];
};

export type RepeatGuard = {
  /** Worn Outfits this day must not repeat, newest wear first. */
  avoid: RecentWear[];
  /** Worn inside the window but allowed again: the closet is too small. */
  released: RecentWear[];
};

/** Whole days from `fromIso` to `toIso` (YYYY-MM-DD, calendar days). */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T12:00:00Z`);
  const to = Date.parse(`${toIso}T12:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Integer 0–30; anything unusable falls back to the default. */
export function clampRepeatWindowDays(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return DEFAULT_REPEAT_WINDOW_DAYS;
  }
  return Math.min(MAX_REPEAT_WINDOW_DAYS, Math.max(0, Math.floor(n)));
}

/** First day a wear can block when planning from `todayIso` onward. */
export function repeatWindowStartIso(
  todayIso: string,
  windowDays: number,
): string {
  return addDaysIso(todayIso, -Math.max(0, windowDays - 1));
}

/**
 * Wears that block `dayIso`: worn fewer than `windowDays` days before it.
 * Worn Monday with a 7-day window blocks through Sunday; Monday is free.
 * A repeat is the exact garment set, so each set appears once (newest wear).
 */
export function wearsBlockingDay(
  wears: readonly RecentWear[],
  dayIso: string,
  windowDays: number,
): RecentWear[] {
  if (windowDays <= 0) return [];
  const newestFirst = wears
    .filter((w) => {
      const age = daysBetweenIso(w.wornOn, dayIso);
      return age >= 0 && age < windowDays;
    })
    .sort((a, b) => b.wornOn.localeCompare(a.wornOn));
  const seen = new Set<string>();
  const out: RecentWear[] = [];
  for (const wear of newestFirst) {
    const key = garmentSetKey(wear.garmentIds);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(wear);
  }
  return out;
}

/**
 * Distinct one-top + bottom + shoes looks the garments can form. A cheap
 * floor on how many different Outfits the closet still has.
 */
export function baseLookCapacity(garments: readonly CatalogGarment[]): number {
  let tops = 0;
  let bottoms = 0;
  let shoes = 0;
  for (const g of garments) {
    if (g.category === "tops") tops += 1;
    else if (g.category === "bottoms") bottoms += 1;
    else if (g.category === "shoes") shoes += 1;
  }
  return tops * bottoms * shoes;
}

/**
 * Repeat guard for one planned day. Only wears the available garments could
 * rebuild matter. When they would use up every look the closet can form,
 * the oldest wears are released until at least one fresh look is left.
 */
export function repeatGuardForDay(input: {
  wears: readonly RecentWear[];
  dayIso: string;
  windowDays: number;
  available: readonly CatalogGarment[];
}): RepeatGuard {
  const availableIds = new Set(input.available.map((g) => g.id));
  const blocking = wearsBlockingDay(
    input.wears,
    input.dayIso,
    input.windowDays,
  ).filter((w) => w.garmentIds.every((id) => availableIds.has(id)));

  const keep = Math.max(0, baseLookCapacity(input.available) - 1);
  return {
    avoid: blocking.slice(0, keep),
    released: blocking.slice(keep),
  };
}

/** True when `garmentIds` is exactly one of the Outfits to avoid. */
export function isRepeatOf(
  garmentIds: readonly string[],
  avoid: readonly RecentWear[],
): boolean {
  const key = garmentSetKey([...garmentIds]);
  return avoid.some((w) => garmentSetKey(w.garmentIds) === key);
}
