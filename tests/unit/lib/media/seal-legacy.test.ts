import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("@/lib/media/assets", () => ({
  insertLegacyMediaAsset: vi.fn(),
}));

vi.mock("@/lib/media/platform-connection", () => ({
  ensurePlatformUploadThingConnection: vi.fn(),
}));

import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { insertLegacyMediaAsset } from "@/lib/media/assets";
import { sealLegacyUploadThingMedia } from "@/lib/media/seal-legacy";

const resolveToken = vi.mocked(resolveUploadThingToken);
const requireSqlMock = vi.mocked(requireSql);
const insertAsset = vi.mocked(insertLegacyMediaAsset);

describe("sealLegacyUploadThingMedia", () => {
  beforeEach(() => {
    resolveToken.mockReset();
    requireSqlMock.mockReset();
    insertAsset.mockReset();
    resolveToken.mockResolvedValue({
      ok: true,
      token: "tok",
      connectionId: "c1",
      source: "user_byok",
    });
  });

  it("binds legacy keys to media assets without changing ACL", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "g1", uploadthing_key: "legacy-key" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);
    insertAsset.mockResolvedValue({
      id: "asset-1",
      userId: "u1",
      connectionId: "c1",
      kind: "closet_image",
      providerFileKey: "legacy-key",
    });

    await sealLegacyUploadThingMedia("u1");

    expect(insertAsset).toHaveBeenCalledWith({
      userId: "u1",
      connectionId: "c1",
      kind: "closet_image",
      fileKey: "legacy-key",
    });
    expect(sql.mock.calls.length).toBe(3);
    const updateStrings = String(sql.mock.calls[2]?.[0] ?? "");
    expect(updateStrings).toMatch(/UPDATE garments/i);
    expect(sql.mock.calls[2]?.[1]).toBe("asset-1");
    expect(sql.mock.calls[2]?.[2]).toBe("/api/media/asset-1");
  });

  it("does nothing when there are no legacy files", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    await sealLegacyUploadThingMedia("u1");
    expect(insertAsset).not.toHaveBeenCalled();
    expect(sql.mock.calls.length).toBe(2);
  });
});
