import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import {
  addDaysIso,
  formatProductWeekday,
} from "@/lib/time/product-timezone";

export type WeeklyPlanDay = {
  iso: string;
  sortOrder: number;
  weekday: string;
};

const WEEK_LENGTH = 7;

/**
 * Offset of `todayIso` from Sunday `weekStartIso` (0–6), or 7 if today
 * is after that week.
 */
export function todaySortOrder(weekStartIso: string, todayIso: string): number {
  for (let i = 0; i < WEEK_LENGTH; i++) {
    if (addDaysIso(weekStartIso, i) === todayIso) return i;
  }
  if (todayIso < weekStartIso) return 0;
  return WEEK_LENGTH;
}

/**
 * Remaining days this Sunday-start week: today through Saturday,
 * skipping days that already have an Outfit.
 */
export function weeklyDaysToPlan(
  weekStartIso: string,
  todayIso: string,
  outfitWornOn: ReadonlySet<string>,
): WeeklyPlanDay[] {
  const days: WeeklyPlanDay[] = [];
  for (let sortOrder = 0; sortOrder < WEEK_LENGTH; sortOrder++) {
    const iso = addDaysIso(weekStartIso, sortOrder);
    if (iso < todayIso) continue;
    if (outfitWornOn.has(iso)) continue;
    days.push({
      iso,
      sortOrder,
      weekday: formatProductWeekday(iso),
    });
  }
  return days;
}

export function closetCategories(
  garments: CatalogGarment[],
): Set<string> {
  return new Set(garments.map((g) => g.category));
}

/**
 * Closet minus Outfit locks. Uniquely used Fit garments stay out unless
 * their category is exhausted (then only that category may reuse).
 */
export function availableGarments(
  garments: CatalogGarment[],
  outfitLockedIds: ReadonlySet<string>,
  uniqueLockedIds: ReadonlySet<string>,
  exhaustedCategories: ReadonlySet<string>,
): CatalogGarment[] {
  return garments.filter((g) => {
    if (outfitLockedIds.has(g.id)) return false;
    if (uniqueLockedIds.has(g.id) && !exhaustedCategories.has(g.category)) {
      return false;
    }
    return true;
  });
}

export function exhaustedCategoriesAfterLook(
  garments: CatalogGarment[],
  outfitLockedIds: ReadonlySet<string>,
  uniqueLockedIds: ReadonlySet<string>,
  closetHas: ReadonlySet<string>,
): Set<string> {
  const exhausted = new Set<string>();
  for (const cat of closetHas) {
    const unused = garments.some(
      (g) =>
        g.category === cat &&
        !outfitLockedIds.has(g.id) &&
        !uniqueLockedIds.has(g.id),
    );
    if (!unused) exhausted.add(cat);
  }
  return exhausted;
}

export function lockLookGarments(
  lookIds: string[],
  outfitLockedIds: ReadonlySet<string>,
  uniqueLockedIds: Set<string>,
): void {
  for (const id of lookIds) {
    if (!outfitLockedIds.has(id)) uniqueLockedIds.add(id);
  }
}
