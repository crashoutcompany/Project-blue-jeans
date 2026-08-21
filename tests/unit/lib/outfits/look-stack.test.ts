import { describe, expect, it } from "vitest";

import {
  lookStackDepartTransform,
  lookStackDirection,
  lookStackDragTransform,
  lookStackOrder,
  lookStackPeekReservePx,
  lookStackRestTransform,
  shouldAdvanceLook,
  wrapLookIndex,
} from "@/lib/outfits/look-stack";

describe("look stack math", () => {
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

  it("offsets resting cards to the right", () => {
    expect(lookStackRestTransform(0)).toBe("translate3d(0px, 0px, 0) scale(1)");
    expect(lookStackRestTransform(1)).toContain("translate3d(20px, 2px, 0)");
    expect(lookStackRestTransform(1)).toContain("scale(0.985)");
  });

  it("flies the departing card off-axis", () => {
    expect(lookStackDepartTransform("next")).toContain("translate3d(-18%");
    expect(lookStackDepartTransform("prev")).toContain("translate3d(18%");
  });

  it("lets the front card follow the pointer", () => {
    const next = lookStackDragTransform(0, -80, 320, 3);
    expect(next).toContain("translate3d(-80px");
    expect(next).toContain("rotate(");
  });

  it("pulls the last card in from the left when dragging previous", () => {
    const incoming = lookStackDragTransform(2, 80, 320, 3);
    expect(incoming).toContain("translate3d(-160px");
  });

  it("advances from distance or velocity", () => {
    expect(shouldAdvanceLook(-80, 0)).toBe("next");
    expect(shouldAdvanceLook(80, 0)).toBe("prev");
    expect(shouldAdvanceLook(-10, -0.6)).toBe("next");
    expect(shouldAdvanceLook(4, 0)).toBeNull();
  });

  it("reserves peek width for the deck", () => {
    expect(lookStackPeekReservePx(1)).toBe(0);
    expect(lookStackPeekReservePx(3)).toBe(40);
  });
});
