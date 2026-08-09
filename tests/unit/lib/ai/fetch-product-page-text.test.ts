import { describe, expect, it } from "vitest";

import { fetchProductPageText } from "@/lib/ai/garments/fetch-product-page-text";

describe("fetchProductPageText", () => {
  it("returns null for unreachable urls", async () => {
    expect(
      await fetchProductPageText("http://127.0.0.1:9/nope"),
    ).toBeNull();
  });
});
