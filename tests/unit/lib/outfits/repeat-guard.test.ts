import { describe, expect, it } from "vitest";

import type { CatalogGarment } from "@/lib/ai/lookbook/catalog";
import {
  baseLookCapacity,
  clampRepeatWindowDays,
  DEFAULT_REPEAT_WINDOW_DAYS,
  isRepeatOf,
  repeatGuardForDay,
  repeatWindowStartIso,
  wearsBlockingDay,
  type RecentWear,
} from "@/lib/outfits/repeat-guard";

function g(id: string, category: string): CatalogGarment {
  return {
    id,
    category,
    name: id,
    color: null,
    notes: null,
    description: null,
  };
}

const wear = (wornOn: string, ...garmentIds: string[]): RecentWear => ({
  wornOn,
  garmentIds,
});

describe("wearsBlockingDay (repeat window)", () => {
  // Monday 2026-08-03 with the default 7-day window.
  const monday = wear("2026-08-03", "top", "jeans", "shoes");

  it("blocks an Outfit for the 7 days after it was worn", () => {
    expect(wearsBlockingDay([monday], "2026-08-04", 7)).toEqual([monday]);
    expect(wearsBlockingDay([monday], "2026-08-09", 7)).toEqual([monday]);
  });

  it("frees it again on day 7", () => {
    expect(wearsBlockingDay([monday], "2026-08-10", 7)).toEqual([]);
  });

  it("follows a custom window", () => {
    expect(wearsBlockingDay([monday], "2026-08-05", 2)).toEqual([]);
    expect(wearsBlockingDay([monday], "2026-08-04", 2)).toEqual([monday]);
    expect(wearsBlockingDay([monday], "2026-08-20", 30)).toEqual([monday]);
  });

  it("is off with a 0-day window", () => {
    expect(wearsBlockingDay([monday], "2026-08-04", 0)).toEqual([]);
  });

  it("ignores wears after the planned day", () => {
    expect(wearsBlockingDay([monday], "2026-08-02", 7)).toEqual([]);
  });

  it("treats the exact garment set as one Outfit, newest wear first", () => {
    const again = wear("2026-08-05", "shoes", "jeans", "top");
    const other = wear("2026-08-04", "top", "chinos", "shoes");
    expect(wearsBlockingDay([monday, other, again], "2026-08-06", 7)).toEqual([
      again,
      other,
    ]);
  });
});

describe("isRepeatOf", () => {
  const avoid = [wear("2026-08-03", "top", "jeans", "shoes")];

  it("matches the same garments in any order", () => {
    expect(isRepeatOf(["shoes", "top", "jeans"], avoid)).toBe(true);
  });

  it("does not count reusing one piece as a repeat", () => {
    expect(isRepeatOf(["top", "chinos", "shoes"], avoid)).toBe(false);
    expect(isRepeatOf(["top", "jeans", "shoes", "hat"], avoid)).toBe(false);
  });

  it("is false with nothing to avoid", () => {
    expect(isRepeatOf(["top", "jeans", "shoes"], [])).toBe(false);
  });
});

describe("repeatGuardForDay fallback", () => {
  const bigCloset = [
    g("t1", "tops"),
    g("t2", "tops"),
    g("b1", "bottoms"),
    g("b2", "bottoms"),
    g("s1", "shoes"),
  ];

  it("avoids every recent wear when the closet has room", () => {
    const wears = [
      wear("2026-08-07", "t1", "b1", "s1"),
      wear("2026-08-06", "t2", "b1", "s1"),
    ];
    // 2 tops x 2 bottoms x 1 shoes = 4 looks, so 2 blocked still leaves 2.
    expect(
      repeatGuardForDay({
        wears,
        dayIso: "2026-08-10",
        windowDays: 7,
        available: bigCloset,
      }),
    ).toEqual({ avoid: wears, released: [] });
  });

  it("allows the oldest repeats when the wardrobe is too small", () => {
    const tiny = [g("t1", "tops"), g("b1", "bottoms"), g("b2", "bottoms"), g("s1", "shoes")];
    const newest = wear("2026-08-08", "t1", "b2", "s1");
    const oldest = wear("2026-08-05", "t1", "b1", "s1");
    // Only 2 base looks exist and both were worn: keep one fresh.
    const guard = repeatGuardForDay({
      wears: [oldest, newest],
      dayIso: "2026-08-10",
      windowDays: 7,
      available: tiny,
    });
    expect(guard.avoid).toEqual([newest]);
    expect(guard.released).toEqual([oldest]);
  });

  it("releases everything when only one look is possible", () => {
    const single = [g("t1", "tops"), g("b1", "bottoms"), g("s1", "shoes")];
    const only = wear("2026-08-08", "t1", "b1", "s1");
    expect(
      repeatGuardForDay({
        wears: [only],
        dayIso: "2026-08-10",
        windowDays: 7,
        available: single,
      }),
    ).toEqual({ avoid: [], released: [only] });
  });

  it("ignores wears the available pieces can't rebuild", () => {
    // t2 is locked this week, so that Outfit can't come back anyway and
    // must not use up the closet's room.
    const available = bigCloset.filter((x) => x.id !== "t2");
    const locked = wear("2026-08-08", "t2", "b1", "s1");
    const open = wear("2026-08-07", "t1", "b1", "s1");
    expect(
      repeatGuardForDay({
        wears: [locked, open],
        dayIso: "2026-08-10",
        windowDays: 7,
        available,
      }),
    ).toEqual({ avoid: [open], released: [] });
  });

  it("skips wears outside the window", () => {
    expect(
      repeatGuardForDay({
        wears: [wear("2026-08-01", "t1", "b1", "s1")],
        dayIso: "2026-08-10",
        windowDays: 7,
        available: bigCloset,
      }).avoid,
    ).toEqual([]);
  });
});

describe("baseLookCapacity", () => {
  it("counts top x bottom x shoes combinations", () => {
    expect(
      baseLookCapacity([
        g("t1", "tops"),
        g("t2", "tops"),
        g("b1", "bottoms"),
        g("s1", "shoes"),
        g("s2", "shoes"),
        g("a1", "accessories"),
      ]),
    ).toBe(4);
    expect(baseLookCapacity([g("t1", "tops"), g("b1", "bottoms")])).toBe(0);
  });
});

describe("repeat window setting", () => {
  it("clamps to 0-30 whole days and defaults to 7", () => {
    expect(DEFAULT_REPEAT_WINDOW_DAYS).toBe(7);
    expect(clampRepeatWindowDays(10)).toBe(10);
    expect(clampRepeatWindowDays("3")).toBe(3);
    expect(clampRepeatWindowDays(4.8)).toBe(4);
    expect(clampRepeatWindowDays(-1)).toBe(0);
    expect(clampRepeatWindowDays(90)).toBe(30);
    expect(clampRepeatWindowDays(null)).toBe(7);
    expect(clampRepeatWindowDays("abc")).toBe(7);
  });

  it("loads wears from far enough back to block today", () => {
    // Worn 2026-08-04 still blocks 2026-08-10 with 7 days; 08-03 does not.
    expect(repeatWindowStartIso("2026-08-10", 7)).toBe("2026-08-04");
    expect(repeatWindowStartIso("2026-08-10", 1)).toBe("2026-08-10");
    expect(repeatWindowStartIso("2026-03-01", 2)).toBe("2026-02-28");
  });
});
