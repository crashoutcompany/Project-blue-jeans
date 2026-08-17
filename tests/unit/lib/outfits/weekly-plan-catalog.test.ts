import { describe, expect, it } from "vitest";

import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import {
  availableGarments,
  closetCategories,
  exhaustedCategoriesAfterLook,
  lockLookGarments,
  todaySortOrder,
  weeklyDaysToPlan,
} from "@/lib/outfits/weekly-plan-catalog";

const TOP_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TOP_B = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const BOTTOM_A = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const BOTTOM_B = "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const SHOE_A = "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

const closet: CatalogGarment[] = [
  { id: TOP_A, category: "tops", name: "Polo", color: null, notes: null, description: null },
  { id: TOP_B, category: "tops", name: "Tee", color: null, notes: null, description: null },
  { id: BOTTOM_A, category: "bottoms", name: "Grey trousers", color: null, notes: null, description: null },
  { id: BOTTOM_B, category: "bottoms", name: "Jeans", color: null, notes: null, description: null },
  { id: SHOE_A, category: "shoes", name: "Sneakers", color: null, notes: null, description: null },
];

describe("weeklyDaysToPlan", () => {
  it("plans today through Saturday and skips Outfit days", () => {
    const days = weeklyDaysToPlan(
      "2026-08-09",
      "2026-08-12",
      new Set(["2026-08-13"]),
    );
    expect(days.map((d) => d.iso)).toEqual([
      "2026-08-12",
      "2026-08-14",
      "2026-08-15",
    ]);
    expect(days[0]?.weekday).toBe("Wednesday");
    expect(days[0]?.sortOrder).toBe(3);
  });

  it("skips days before today", () => {
    const days = weeklyDaysToPlan("2026-08-09", "2026-08-15", new Set());
    expect(days.map((d) => d.iso)).toEqual(["2026-08-15"]);
  });

  it("maps today to the Sunday-start sort order", () => {
    expect(todaySortOrder("2026-08-09", "2026-08-12")).toBe(3);
    expect(todaySortOrder("2026-08-09", "2026-08-09")).toBe(0);
    expect(todaySortOrder("2026-08-09", "2026-08-16")).toBe(7);
  });
});

describe("availableGarments", () => {
  it("never returns Outfit-locked garments even when a category is exhausted", () => {
    const unique = new Set([TOP_B]);
    const exhausted = exhaustedCategoriesAfterLook(
      closet,
      new Set([TOP_A]),
      unique,
      closetCategories(closet),
    );
    expect(exhausted.has("tops")).toBe(true);
    const available = availableGarments(
      closet,
      new Set([TOP_A]),
      unique,
      exhausted,
    );
    expect(available.map((g) => g.id)).not.toContain(TOP_A);
    expect(available.map((g) => g.id)).toContain(TOP_B);
  });

  it("reuses only the exhausted category", () => {
    const unique = new Set<string>();
    lockLookGarments([TOP_A, BOTTOM_A, SHOE_A], new Set(), unique);
    const exhausted = exhaustedCategoriesAfterLook(
      closet,
      new Set(),
      unique,
      closetCategories(closet),
    );
    expect(exhausted.has("shoes")).toBe(true);
    expect(exhausted.has("tops")).toBe(false);

    const available = availableGarments(closet, new Set(), unique, exhausted);
    expect(available.map((g) => g.id).sort()).toEqual(
      [TOP_B, BOTTOM_B, SHOE_A].sort(),
    );
  });
});
