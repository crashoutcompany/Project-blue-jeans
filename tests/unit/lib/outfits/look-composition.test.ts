import { describe, expect, it } from "vitest";

import {
  catalogCanFormLook,
  lookStackError,
  countLookSlots,
  validateMustWearIncludes,
  validateIncludeAvoidPair,
} from "@/lib/outfits/look-composition";

const TOP = "t1";
const BOTTOM = "b1";
const SHOE = "s1";
const OUTER = "o1";
const ACC = "a1";

const categoryById = new Map([
  [TOP, "tops"],
  [BOTTOM, "bottoms"],
  [SHOE, "shoes"],
  [OUTER, "outerwear"],
  [ACC, "accessories"],
]);

describe("look composition", () => {
  it("requires a top, bottom, and shoes to form a look", () => {
    expect(
      catalogCanFormLook([
        { id: TOP, category: "tops", name: "Tee", color: null, notes: null, description: null },
        { id: BOTTOM, category: "bottoms", name: "Jeans", color: null, notes: null, description: null },
      ]),
    ).toBe(false);
    expect(
      catalogCanFormLook([
        { id: TOP, category: "tops", name: "Tee", color: null, notes: null, description: null },
        { id: BOTTOM, category: "bottoms", name: "Jeans", color: null, notes: null, description: null },
        { id: SHOE, category: "shoes", name: "Sneakers", color: null, notes: null, description: null },
      ]),
    ).toBe(true);
  });

  it("allows a second top and optional outerwear", () => {
    const counts = countLookSlots(
      [TOP, "t2", BOTTOM, SHOE, OUTER],
      new Map([...categoryById, ["t2", "tops"]]),
    );
    expect(lookStackError(counts)).toBeNull();
  });

  it("treats Include as must-wear without requiring a full stack", () => {
    expect(validateMustWearIncludes([TOP], categoryById)).toBeNull();
    expect(validateMustWearIncludes([TOP, BOTTOM, SHOE, OUTER], categoryById)).toBe(
      "Include at most 3 pieces.",
    );
  });

  it("rejects a second bottom or pair of shoes", () => {
    const cats = new Map([...categoryById, ["b2", "bottoms"], ["s2", "shoes"]]);
    expect(
      lookStackError(countLookSlots([TOP, BOTTOM, "b2", SHOE], cats)),
    ).toBe("A look can use at most one bottom.");
    expect(
      lookStackError(countLookSlots([TOP, BOTTOM, SHOE, "s2"], cats)),
    ).toBe("A look can use at most one pair of shoes.");
    expect(validateMustWearIncludes([BOTTOM, "b2"], cats)).toBe(
      "A look can use at most one bottom.",
    );
  });

  it("rejects a piece that is both included and avoided", () => {
    expect(validateIncludeAvoidPair([TOP], [TOP])).toBe(
      "A piece cannot be both included and avoided.",
    );
  });
});
