import { describe, expect, it } from "vitest";

import {
  DEFAULT_OUTFIT_LOCATION,
  resolveOutfitLocation,
} from "@/lib/ai/weather/constants";

describe("resolveOutfitLocation", () => {
  it("defaults to New York, NY", () => {
    expect(resolveOutfitLocation()).toBe(DEFAULT_OUTFIT_LOCATION);
    expect(resolveOutfitLocation("")).toBe(DEFAULT_OUTFIT_LOCATION);
    expect(resolveOutfitLocation("   ")).toBe(DEFAULT_OUTFIT_LOCATION);
  });

  it("uses user override when provided", () => {
    expect(resolveOutfitLocation("Miami, FL")).toBe("Miami, FL");
  });
});
