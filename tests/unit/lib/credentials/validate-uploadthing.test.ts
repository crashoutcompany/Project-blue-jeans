import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decodeUploadThingAppId,
  ufsUrlBelongsToApp,
  validateUploadThingToken,
} from "@/lib/credentials/validate-uploadthing";

const uploadFiles = vi.fn();
const deleteFiles = vi.fn();

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    uploadFiles = uploadFiles;
    deleteFiles = deleteFiles;
  },
}));

function tokenFor(appId: string, apiKey = "sk_live_test"): string {
  return Buffer.from(
    JSON.stringify({ apiKey, appId, regions: ["sea1"] }),
  ).toString("base64");
}

describe("validateUploadThingToken", () => {
  afterEach(() => {
    uploadFiles.mockReset();
    deleteFiles.mockReset();
  });

  it("accepts a token whose probe upload lands in the claimed app", async () => {
    uploadFiles.mockResolvedValue({
      data: { key: "probe-key", ufsUrl: "https://app-123.ufs.sh/f/probe-key" },
      error: null,
    });
    deleteFiles.mockResolvedValue({ success: true });
    const token = tokenFor("app-123");

    await expect(validateUploadThingToken(token)).resolves.toEqual({
      ok: true,
      token,
      appId: "app-123",
    });
    expect(deleteFiles).toHaveBeenCalledWith("probe-key");
  });

  it("rejects a token whose appId names a different app than the API key", async () => {
    uploadFiles.mockResolvedValue({
      data: { key: "probe-key", ufsUrl: "https://real-app.ufs.sh/f/probe-key" },
      error: null,
    });
    deleteFiles.mockResolvedValue({ success: true });

    await expect(
      validateUploadThingToken(tokenFor("someone-elses-app")),
    ).resolves.toEqual({
      ok: false,
      message: "That UploadThing token could not be verified.",
    });
    expect(deleteFiles).toHaveBeenCalledWith("probe-key");
  });

  it("rejects a token when ingest refuses the probe upload", async () => {
    uploadFiles.mockResolvedValue({
      data: null,
      error: { code: "UPLOAD_FAILED", message: "Invalid signature" },
    });

    await expect(
      validateUploadThingToken(tokenFor("someone-elses-app")),
    ).resolves.toEqual({
      ok: false,
      message: "That UploadThing token could not be verified.",
    });
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("still accepts a verified token if deleting the probe fails", async () => {
    uploadFiles.mockResolvedValue({
      data: { key: "probe-key", ufsUrl: "https://ufs.sh/a/app-123/probe-key" },
      error: null,
    });
    deleteFiles.mockRejectedValue(new Error("network"));

    await expect(validateUploadThingToken(tokenFor("app-123"))).resolves.toEqual(
      expect.objectContaining({ ok: true, appId: "app-123" }),
    );
  });

  it("returns a generic error for an invalid token", async () => {
    uploadFiles.mockRejectedValue(new Error("401"));

    const result = await validateUploadThingToken(
      tokenFor("app-bad", "sk_live_bad"),
    );
    expect(result).toEqual({
      ok: false,
      message: "That UploadThing token could not be verified.",
    });
    expect(JSON.stringify(result)).not.toContain("sk_live_bad");
  });
});

describe("ufsUrlBelongsToApp", () => {
  it("matches subdomain and path-style UFS URLs only for the same app", () => {
    expect(ufsUrlBelongsToApp("https://app-1.ufs.sh/f/k", "app-1")).toBe(true);
    expect(ufsUrlBelongsToApp("https://ufs.sh/a/app-1/k", "app-1")).toBe(true);
    expect(ufsUrlBelongsToApp("https://app-2.ufs.sh/f/k", "app-1")).toBe(false);
    expect(ufsUrlBelongsToApp("https://ufs.sh/a/app-10/k", "app-1")).toBe(false);
    expect(ufsUrlBelongsToApp("not a url", "app-1")).toBe(false);
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
