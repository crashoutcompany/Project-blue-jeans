import { describe, expect, it } from "vitest";

import { extractProductUrls } from "@/lib/ai/garments/extract-product-urls";

describe("extractProductUrls", () => {
  it("returns empty for blank notes", () => {
    expect(extractProductUrls(null)).toEqual([]);
    expect(extractProductUrls("")).toEqual([]);
    expect(extractProductUrls("   ")).toEqual([]);
  });

  it("extracts and dedupes http(s) urls", () => {
    expect(
      extractProductUrls(
        "Love these — https://shop.example.com/p/trousers?color=navy and again https://shop.example.com/p/trousers?color=navy",
      ),
    ).toEqual(["https://shop.example.com/p/trousers?color=navy"]);
  });

  it("strips trailing punctuation", () => {
    expect(
      extractProductUrls("See https://example.com/item). Also http://a.test/x."),
    ).toEqual(["https://example.com/item", "http://a.test/x"]);
  });
});
