import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import type { GarmentCategoryDb } from "@/lib/garments/types";

export const MAX_MUST_WEAR_INCLUDES = 3;
export const MAX_TOPS_PER_LOOK = 2;
export const MAX_BOTTOMS_PER_LOOK = 1;
export const MAX_SHOES_PER_LOOK = 1;
export const MAX_OUTERWEAR_PER_LOOK = 1;
export const MAX_ACCESSORIES_PER_LOOK = 3;

export type LookSlotCounts = {
  tops: number;
  bottoms: number;
  shoes: number;
  outerwear: number;
  accessories: number;
  other: number;
};

const EMPTY_COUNTS: LookSlotCounts = {
  tops: 0,
  bottoms: 0,
  shoes: 0,
  outerwear: 0,
  accessories: 0,
  other: 0,
};

export function isWeeklyUniqueCategory(category: string): boolean {
  return category === "tops";
}

export function countLookSlots(
  ids: readonly string[],
  categoryById: ReadonlyMap<string, string>,
): LookSlotCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const id of ids) {
    const category = categoryById.get(id);
    if (category === "tops") counts.tops += 1;
    else if (category === "bottoms") counts.bottoms += 1;
    else if (category === "shoes") counts.shoes += 1;
    else if (category === "outerwear") counts.outerwear += 1;
    else if (category === "accessories") counts.accessories += 1;
    else counts.other += 1;
  }
  return counts;
}

export function catalogCanFormLook(garments: readonly CatalogGarment[]): boolean {
  let tops = 0;
  let bottoms = 0;
  let shoes = 0;
  for (const g of garments) {
    if (g.category === "tops") tops += 1;
    else if (g.category === "bottoms") bottoms += 1;
    else if (g.category === "shoes") shoes += 1;
    if (tops > 0 && bottoms > 0 && shoes > 0) return true;
  }
  return false;
}

export function lookStackError(
  counts: LookSlotCounts,
): string | null {
  if (counts.tops < 1) return "Each look needs at least one top.";
  if (counts.bottoms < 1) return "Each look needs a bottom.";
  if (counts.shoes < 1) return "Each look needs shoes.";
  return lookSlotCapError(counts);
}

function lookSlotCapError(counts: LookSlotCounts): string | null {
  if (counts.tops > MAX_TOPS_PER_LOOK) {
    return "A look can use at most two tops.";
  }
  if (counts.bottoms > MAX_BOTTOMS_PER_LOOK) {
    return "A look can use at most one bottom.";
  }
  if (counts.shoes > MAX_SHOES_PER_LOOK) {
    return "A look can use at most one pair of shoes.";
  }
  if (counts.outerwear > MAX_OUTERWEAR_PER_LOOK) {
    return "A look can use at most one outerwear piece.";
  }
  if (counts.accessories > MAX_ACCESSORIES_PER_LOOK) {
    return "A look can use at most three accessories.";
  }
  return null;
}

export function validateMustWearIncludes(
  includedIds: readonly string[],
  categoryById: ReadonlyMap<string, string>,
): string | null {
  if (includedIds.length > MAX_MUST_WEAR_INCLUDES) {
    return `Include at most ${MAX_MUST_WEAR_INCLUDES} pieces.`;
  }
  const unique = [...new Set(includedIds)];
  if (unique.length !== includedIds.length) {
    return "Include the same piece only once.";
  }
  for (const id of unique) {
    if (!categoryById.has(id)) {
      return "An included piece is not in your closet.";
    }
  }
  const counts = countLookSlots(unique, categoryById);
  return lookSlotCapError(counts);
}

export function validateIncludeAvoidPair(
  includedIds: readonly string[],
  avoidedIds: readonly string[],
): string | null {
  const avoided = new Set(avoidedIds);
  for (const id of includedIds) {
    if (avoided.has(id)) {
      return "A piece cannot be both included and avoided.";
    }
  }
  return null;
}

export function lookContainsAll(
  lookIds: readonly string[],
  requiredIds: readonly string[],
): boolean {
  if (requiredIds.length === 0) return true;
  const set = new Set(lookIds);
  return requiredIds.every((id) => set.has(id));
}

export function categoryByIdFromCatalog(
  garments: readonly { id: string; category: string }[],
): Map<string, string> {
  return new Map(garments.map((g) => [g.id, g.category]));
}

/** Upload / AI hint: structured shells vs knits/shirts vs extras. */
export function outerwearVsTopsHint(): string {
  return [
    "Outerwear is a structured weather or tailoring shell: coat, parka, puffer, trench, blazer, hard jacket.",
    "Hoodies, sweaters, flannels, overshirts, and cardigans are Tops.",
    "Hats, scarves, belts, bags, and jewelry are Accessories.",
  ].join(" ");
}

export function isGarmentCategoryName(v: string): v is GarmentCategoryDb {
  return (
    v === "tops" ||
    v === "bottoms" ||
    v === "shoes" ||
    v === "outerwear" ||
    v === "accessories"
  );
}
