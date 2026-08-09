import { describe, expect, it } from "vitest";

import { garmentSetKey } from "@/lib/outfits/garment-set-key";

describe("garmentSetKey", () => {
  const a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("sorts and dedupes ids", () => {
    expect(garmentSetKey([b, a, a])).toBe(`${a},${b}`);
  });

  it("is order-independent", () => {
    expect(garmentSetKey([a, b])).toBe(garmentSetKey([b, a]));
  });
});
