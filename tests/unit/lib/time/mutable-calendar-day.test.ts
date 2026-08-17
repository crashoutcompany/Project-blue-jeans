import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    productTodayIso: vi.fn(() => "2026-08-10"),
  };
});

import { assertMutableWornOn } from "@/lib/time/mutable-calendar-day";

describe("assertMutableWornOn", () => {
  it("rejects past days", () => {
    const res = assertMutableWornOn("2026-08-09");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/past/i);
  });

  it("allows today and future", () => {
    expect(assertMutableWornOn("2026-08-10").ok).toBe(true);
    expect(assertMutableWornOn("2026-08-12").ok).toBe(true);
  });
});
