import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  formatProductDateLong,
  productTodayIso,
  sundayWeekStartIso,
} from "@/lib/time/product-timezone";

describe("product-timezone", () => {
  it("formats a known instant as America/New_York calendar date", () => {
    // 2026-08-09 03:30 UTC → still Aug 8 evening in New York (EDT)
    const d = new Date("2026-08-09T03:30:00.000Z");
    expect(productTodayIso(d)).toBe("2026-08-08");
  });

  it("returns Sunday week start for a Wednesday", () => {
    expect(sundayWeekStartIso("2026-08-12")).toBe("2026-08-09");
  });

  it("returns the same day when the date is already Sunday", () => {
    expect(sundayWeekStartIso("2026-08-09")).toBe("2026-08-09");
  });

  it("adds days across month boundaries", () => {
    expect(addDaysIso("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("formats a long product date heading", () => {
    expect(formatProductDateLong("2026-08-10")).toBe("Monday, August 10");
  });
});
