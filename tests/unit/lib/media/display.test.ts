import { describe, expect, it } from "vitest";

import {
  mediaAssetDisplayPath,
  parseMediaAssetIdFromPath,
  shouldBypassImageOptimizer,
} from "@/lib/media/display";

describe("media display helpers", () => {
  it("builds same-origin display paths", () => {
    const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    expect(mediaAssetDisplayPath(id)).toBe(`/api/media/${id}`);
    expect(parseMediaAssetIdFromPath(`/api/media/${id}`)).toBe(id);
  });

  it("bypasses the image optimizer for private media paths", () => {
    expect(
      shouldBypassImageOptimizer(
        "/api/media/f47ac10b-58cc-4372-a567-0e02b2c3d479",
      ),
    ).toBe(true);
    expect(shouldBypassImageOptimizer("https://cdn.example.com/a.jpg")).toBe(
      false,
    );
  });
});
