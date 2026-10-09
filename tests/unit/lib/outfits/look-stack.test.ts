import { describe, expect, it } from "vitest";

import {
  lookStackDirection,
  lookStackOrder,
  shouldAdvanceLook,
  wrapLookIndex,
} from "@/lib/outfits/look-stack";

describe("look stack navigation", () => {
  it("wraps indices in both directions", () => {
    expect(wrapLookIndex(3, 3)).toBe(0);
    expect(wrapLookIndex(-1, 3)).toBe(2);
    expect(wrapLookIndex(0, 0)).toBe(0);
  });

  it("orders cards relative to the active index", () => {
    expect(lookStackOrder(0, 0, 3)).toBe(0);
    expect(lookStackOrder(1, 0, 3)).toBe(1);
    expect(lookStackOrder(2, 0, 3)).toBe(2);
    expect(lookStackOrder(0, 1, 3)).toBe(2);
    expect(lookStackOrder(1, 1, 3)).toBe(0);
  });

  it("picks the shorter wrap direction", () => {
    expect(lookStackDirection(0, 1, 3)).toBe("next");
    expect(lookStackDirection(0, 2, 3)).toBe("prev");
    expect(lookStackDirection(2, 0, 3)).toBe("next");
  });

  it("advances from distance or velocity", () => {
    expect(shouldAdvanceLook(-80, 0)).toBe("next");
    expect(shouldAdvanceLook(80, 0)).toBe("prev");
    expect(shouldAdvanceLook(-10, -0.6)).toBe("next");
    expect(shouldAdvanceLook(4, 0)).toBeNull();
  });
});
