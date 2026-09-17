import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingTokenForConnection: vi.fn(),
}));

vi.mock("@/lib/media/assets", () => ({
  getOwnedMediaAsset: vi.fn(),
}));

vi.mock("@/lib/ai/fetch-image-part", () => ({
  fetchUrlAsImagePart: vi.fn(),
}));

import { resolveUploadThingTokenForConnection } from "@/lib/credentials/resolve";
import { getOwnedMediaAsset } from "@/lib/media/assets";
import { resolveOwnedImageFetchUrl } from "@/lib/media/owned-image";

const resolveToken = vi.mocked(resolveUploadThingTokenForConnection);
const getAsset = vi.mocked(getOwnedMediaAsset);

function tokenFor(appId?: string): string {
  return Buffer.from(
    JSON.stringify({
      apiKey: "sk_live_test",
      ...(appId ? { appId } : {}),
      regions: ["sea1"],
    }),
  ).toString("base64");
}

describe("resolveOwnedImageFetchUrl", () => {
  beforeEach(() => {
    resolveToken.mockReset();
    getAsset.mockReset();
    getAsset.mockResolvedValue({
      id: "asset-1",
      userId: "u1",
      connectionId: "c1",
      kind: "closet_image",
      providerFileKey: "fileKey1",
    });
  });

  it("builds a public CDN URL when the token has an app id", async () => {
    resolveToken.mockResolvedValue({
      ok: true,
      token: tokenFor("tcsdez3brx"),
      connectionId: "c1",
      source: "user_byok",
    });

    await expect(
      resolveOwnedImageFetchUrl("u1", { mediaAssetId: "asset-1" }),
    ).resolves.toBe("https://tcsdez3brx.ufs.sh/f/fileKey1");
  });

  it("returns null when the token has no app id", async () => {
    resolveToken.mockResolvedValue({
      ok: true,
      token: tokenFor(),
      connectionId: "c1",
      source: "user_byok",
    });

    await expect(
      resolveOwnedImageFetchUrl("u1", { mediaAssetId: "asset-1" }),
    ).resolves.toBeNull();
  });
});
