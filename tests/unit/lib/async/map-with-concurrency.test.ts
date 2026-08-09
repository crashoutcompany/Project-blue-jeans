import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("preserves order and bounds concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5, 6];

    const out = await mapWithConcurrency(items, 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return n * 10;
    });

    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("returns empty for empty input", async () => {
    expect(await mapWithConcurrency([], 3, async (x) => x)).toEqual([]);
  });
});
