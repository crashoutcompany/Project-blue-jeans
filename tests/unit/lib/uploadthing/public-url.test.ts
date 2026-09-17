import { describe, expect, it } from "vitest";

import { publicFileUrl, publicImageUrl } from "@/lib/uploadthing/public-url";

describe("publicFileUrl", () => {
  it("builds the v7 CDN URL", () => {
    expect(publicFileUrl("tcsdez3brx", "IJeO8J2i9dyTHgZZRYeO9jsBKyUh6zRbx2VXYwPdvWGA5N8o")).toBe(
      "https://tcsdez3brx.ufs.sh/f/IJeO8J2i9dyTHgZZRYeO9jsBKyUh6zRbx2VXYwPdvWGA5N8o",
    );
  });

  it("accepts filename-style keys with a period", () => {
    expect(
      publicFileUrl(
        "tcsdez3brx",
        "2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg",
      ),
    ).toBe(
      "https://tcsdez3brx.ufs.sh/f/2e0fdb64-9957-4262-8e45-f372ba903ac8_image.jpg",
    );
  });

  it("rejects host-unsafe app ids", () => {
    expect(() => publicFileUrl("evil.example", "abc")).toThrow(
      "Invalid UploadThing file.",
    );
  });

  it("rejects path-like file keys", () => {
    expect(() => publicFileUrl("tcsdez3brx", "../secret")).toThrow(
      "Invalid UploadThing file.",
    );
  });
});

describe("publicImageUrl", () => {
  it("prefers ufsUrl", () => {
    expect(
      publicImageUrl({
        ufsUrl: "https://app.ufs.sh/f/a",
        url: "https://utfs.io/f/a",
      }),
    ).toBe("https://app.ufs.sh/f/a");
  });
});
