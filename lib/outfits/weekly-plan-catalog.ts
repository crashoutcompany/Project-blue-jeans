import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import { isWeeklyUniqueCategory } from "@/lib/outfits/look-composition";
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

/**
 * Bottoms, shoes, outerwear, and accessories may repeat. Tops used in a
 * committed Outfit or an earlier planned Fit stay out of remaining days.
 */
export function availableGarments(
  garments: CatalogGarment[],
  lockedTopIds: ReadonlySet<string>,
): CatalogGarment[] {
  return garments.filter((g) => {
    if (!isWeeklyUniqueCategory(g.category)) return true;
    return !lockedTopIds.has(g.id);
  });
}

export function lockLookTops(
  lookIds: readonly string[],
  categoryById: ReadonlyMap<string, string>,
  lockedTopIds: Set<string>,
): void {
  for (const id of lookIds) {
    if (isWeeklyUniqueCategory(categoryById.get(id) ?? "")) {
      lockedTopIds.add(id);
    }
  }
}
