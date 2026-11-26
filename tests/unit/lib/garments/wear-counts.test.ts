import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

import { getSql } from "@/lib/db";
import { formatWearCount } from "@/lib/garments/wear-count-label";
import {
  loadGarmentWearCounts,
  withWearCounts,
} from "@/lib/garments/wear-counts";

const getSqlMock = vi.mocked(getSql);
const G1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const G2 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("loadGarmentWearCounts", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
  });

  it("counts only confirmed Wore this days, scoped to the Wearer", async () => {
    const sql = vi.fn().mockResolvedValue([
      { garment_id: G1, wear_count: 3 },
      { garment_id: G2, wear_count: "1" },
    ]);
    getSqlMock.mockReturnValue(sql as never);

    await expect(loadGarmentWearCounts("u1")).resolves.toEqual({
      [G1]: 3,
      [G2]: 1,
    });

    const [strings, ...values] = sql.mock.calls[0]!;
    const text = (strings as string[]).join(" ");
    expect(text).toMatch(/worn_confirmed_at IS NOT NULL/);
    expect(text).toMatch(/GROUP BY og\.garment_id/);
    expect(values).toEqual(["u1", "u1"]);
  });

  it("returns no counts without a database", async () => {
    getSqlMock.mockReturnValue(null as never);
    await expect(loadGarmentWearCounts("u1")).resolves.toEqual({});
  });

  /** An empty result would be cached as "never worn" for every piece. */
  it("rethrows a database failure instead of caching empty counts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("boom")) as never,
    );
    await expect(loadGarmentWearCounts("u1")).rejects.toThrow("boom");
  });
});

describe("withWearCounts", () => {
  it("defaults pieces that were never worn to 0", () => {
    const cards = withWearCounts(
      [
        { id: G1, name: "Tee", category: "tops" },
        { id: G2, name: "Jeans", category: "bottoms" },
      ],
      { [G1]: 2 },
    );
    expect(cards.map((c) => c.wearCount)).toEqual([2, 0]);
  });
});

describe("formatWearCount", () => {
  it("labels zero, one, and many wears", () => {
    expect(formatWearCount(0)).toBe("Never worn");
    expect(formatWearCount(1)).toBe("Worn once");
    expect(formatWearCount(4)).toBe("Worn 4 times");
  });
});
