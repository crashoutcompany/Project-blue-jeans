import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveGeminiApiKey: vi.fn(),
}));

vi.mock("@/lib/ai/garments/describe-from-image", () => ({
  analyzeGarmentFromImageUrl: vi.fn(),
}));

vi.mock("@/lib/media/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/media/assets")>();
  return {
    ...actual,
    claimOwnedMediaAssets: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { claimOwnedMediaAssets } from "@/lib/media/assets";
import { persistUploadedGarmentItems } from "@/lib/garments/persist-uploaded-garments";

const resolveGemini = vi.mocked(resolveGeminiApiKey);
const requireSqlMock = vi.mocked(requireSql);
const claimMock = vi.mocked(claimOwnedMediaAssets);

const mediaId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("persistUploadedGarmentItems", () => {
  beforeEach(() => {
    resolveGemini.mockReset();
    requireSqlMock.mockReset();
    claimMock.mockReset();
  });

  it("returns ok for empty items", async () => {
    const res = await persistUploadedGarmentItems("u1", []);
    expect(res.ok).toBe(true);
  });

  it("returns error when media id missing", async () => {
    const res = await persistUploadedGarmentItems("u1", [
      {
        mediaAssetId: "not-a-uuid",
        name: "n",
        category: "tops",
      },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("media id");
  });

  it("returns error for invalid category", async () => {
    const res = await persistUploadedGarmentItems("u1", [
      {
        mediaAssetId: mediaId,
        name: "n",
        category: "invalid" as "tops",
      },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Invalid category");
  });

  it("inserts without Gemini when credentials missing", async () => {
    resolveGemini.mockResolvedValue({
      ok: false,
      message: "Connect Google AI Studio in Settings before using this feature.",
    });
    claimMock.mockResolvedValue({
      ok: true,
      assets: [
        {
          id: mediaId,
          userId: "u1",
          connectionId: "c1",
          kind: "closet_image",
          providerFileKey: "file-key",
        },
      ],
    });
    const sql = vi.fn().mockResolvedValue(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    const res = await persistUploadedGarmentItems("u1", [
      {
        mediaAssetId: mediaId,
        name: "n",
        category: "tops",
      },
    ]);
    expect(res.ok).toBe(true);
    expect(sql).toHaveBeenCalled();
  });

  it("rejects duplicate media ids in one request", async () => {
    const res = await persistUploadedGarmentItems("u1", [
      { mediaAssetId: mediaId, name: "a", category: "tops" },
      { mediaAssetId: mediaId.toUpperCase(), name: "b", category: "tops" },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("only be added once");
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("rejects batches larger than 24", async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      mediaAssetId: `f47ac10b-58cc-4372-a567-0e02b2c3d4${String(i).padStart(2, "0")}`,
      name: "n",
      category: "tops" as const,
    }));
    const res = await persistUploadedGarmentItems("u1", items);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("24");
  });
});
