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

vi.mock("@/lib/media/uploadthing-api", () => ({
  makeUploadThingFilesPrivate: vi.fn(),
}));

import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { insertLegacyMediaAsset } from "@/lib/media/assets";
import { makeUploadThingFilesPrivate } from "@/lib/media/uploadthing-api";
import { sealLegacyUploadThingMedia } from "@/lib/media/seal-legacy";

const resolveToken = vi.mocked(resolveUploadThingToken);
const requireSqlMock = vi.mocked(requireSql);
const insertAsset = vi.mocked(insertLegacyMediaAsset);
const makePrivate = vi.mocked(makeUploadThingFilesPrivate);

describe("sealLegacyUploadThingMedia", () => {
  beforeEach(() => {
    resolveToken.mockReset();
    requireSqlMock.mockReset();
    insertAsset.mockReset();
    makePrivate.mockReset();
    resolveToken.mockResolvedValue({
      ok: true,
      token: "tok",
      connectionId: "c1",
      source: "user_byok",
    });
  });

  it("does not rewrite URLs when ACL sealing fails", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "g1", uploadthing_key: "legacy-key" },
      ])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);
    makePrivate.mockResolvedValue(false);

    await sealLegacyUploadThingMedia("u1");
    expect(insertAsset).not.toHaveBeenCalled();
    expect(sql.mock.calls.length).toBe(2);
  });
});
