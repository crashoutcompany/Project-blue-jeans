import { describe, expect, it } from "vitest";

import { outputMimeTypeForUpload } from "@/lib/compress-image";

describe("outputMimeTypeForUpload", () => {
  it("keeps PNG so alpha is not flattened to JPEG white", () => {
    const file = new File([""], "shirt.png", { type: "image/png" });
    expect(outputMimeTypeForUpload(file)).toBe("image/png");
  });

  it("keeps WebP for the same reason", () => {
    const file = new File([""], "shirt.webp", { type: "image/webp" });
    expect(outputMimeTypeForUpload(file)).toBe("image/webp");
  });

  it("uses JPEG for typical camera photos", () => {
    const file = new File([""], "IMG_001.jpg", { type: "image/jpeg" });
    expect(outputMimeTypeForUpload(file)).toBe("image/jpeg");
  });

  it("falls back to extension when MIME is missing", () => {
    const file = new File([""], "cutout.png", { type: "" });
    expect(outputMimeTypeForUpload(file)).toBe("image/png");
  });
});
