import { describe, expect, it } from "vitest";

import {
  OUTFIT_OCCASIONS,
  outfitOccasionSchema,
} from "@/lib/outfits/occasions";

describe("outfitOccasionSchema", () => {
  it("accepts every enum value", () => {
    for (const o of OUTFIT_OCCASIONS) {
      expect(outfitOccasionSchema.safeParse(o).success).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(outfitOccasionSchema.safeParse("party").success).toBe(false);
  });
});
