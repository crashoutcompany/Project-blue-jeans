import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decodeUploadThingAppId,
  validateUploadThingToken,
} from "@/lib/credentials/validate-uploadthing";

const getUsageInfo = vi.fn();

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    getUsageInfo = getUsageInfo;
  },
}));

describe("validateUploadThingToken", () => {
  afterEach(() => {
    getUsageInfo.mockReset();
  });

  it("accepts a token when UploadThing returns usage metadata", async () => {
    getUsageInfo.mockResolvedValue({ filesUploaded: 1 });
    const token = Buffer.from(
      JSON.stringify({
        apiKey: "sk_live_test",
        appId: "app-123",
        regions: ["sea1"],
      }),
    ).toString("base64");

    await expect(validateUploadThingToken(token)).resolves.toEqual({
      ok: true,
      token,
      appId: "app-123",
    });
    expect(getUsageInfo).toHaveBeenCalled();
  });

  it("returns a generic error for an invalid token", async () => {
    getUsageInfo.mockRejectedValue(new Error("401"));
    const token = Buffer.from(
      JSON.stringify({
        apiKey: "sk_live_bad",
        appId: "app-bad",
        regions: ["sea1"],
      }),
    ).toString("base64");

    const result = await validateUploadThingToken(token);
    expect(result).toEqual({
      ok: false,
      message: "That UploadThing token could not be verified.",
    });
    expect(JSON.stringify(result)).not.toContain("sk_live_bad");
  });
});

describe("decodeUploadThingAppId", () => {
  it("reads appId from base64 JSON tokens", () => {
    const token = Buffer.from(
      JSON.stringify({ appId: "app-xyz", apiKey: "secret" }),
    ).toString("base64");
    expect(decodeUploadThingAppId(token)).toBe("app-xyz");
  });
});
