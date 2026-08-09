import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchProductPageText } from "@/lib/ai/garments/fetch-product-page-text";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchProductPageText", () => {
  it("returns null when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchProductPageText("https://shop.example.com/item")).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns null when Content-Length exceeds raw byte cap", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("ignored", {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": String(600_000),
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchProductPageText("https://shop.example.com/huge")).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns plain text excerpt for a small HTML page", async () => {
    const html =
      "<html><body><h1>Navy Wool Trousers</h1><p>Italian wool, tapered fit, zip fly.</p></body></html>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await fetchProductPageText("https://shop.example.com/trousers");
    expect(text).toContain("Navy Wool Trousers");
    expect(text).toContain("Italian wool");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
