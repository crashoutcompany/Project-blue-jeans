import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingToken: vi.fn(),
}));

vi.mock("@/lib/uploadthing-server", () => ({
  deleteUploadThingFiles: vi.fn(),
}));

vi.mock("@/lib/media/assets", () => ({
  getOwnedMediaAsset: vi.fn(),
}));

import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { getOwnedMediaAsset } from "@/lib/media/assets";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";
import { clearWearerPhoto, saveWearerPhoto } from "@/lib/wearer/profile";

const requireSqlMock = vi.mocked(requireSql);
const deleteFilesMock = vi.mocked(deleteUploadThingFiles);
const resolveUploadMock = vi.mocked(resolveUploadThingToken);
const getAssetMock = vi.mocked(getOwnedMediaAsset);

const mediaId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("wearer photo UploadThing cleanup", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
    deleteFilesMock.mockReset();
    resolveUploadMock.mockReset();
    getAssetMock.mockReset();
    deleteFilesMock.mockResolvedValue(undefined);
    resolveUploadMock.mockResolvedValue({
      ok: true,
      token: "owner-token",
      connectionId: null,
      source: "platform_env",
    });
    getAssetMock.mockResolvedValue({
      id: mediaId,
      userId: "u1",
      connectionId: "c1",
      kind: "wearer_photo",
      providerFileKey: "new-key",
    });
  });

  it("does not delete a file on first save", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      mediaAssetId: mediaId,
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("deletes the previous file when the photo is replaced", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "old-key", media_asset_id: "old-media" }])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      mediaAssetId: mediaId,
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).toHaveBeenCalledWith(["old-key"], "owner-token");
  });

  it("deletes a previous media row even when there is no file key", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        { uploadthing_key: null, media_asset_id: "old-media" },
      ])
      .mockResolvedValue([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      mediaAssetId: mediaId,
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
    const sent = sql.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sent).toMatch(/DELETE FROM media_assets/i);
  });

  it("keeps the file when the key is unchanged", async () => {
    getAssetMock.mockResolvedValue({
      id: mediaId,
      userId: "u1",
      connectionId: "c1",
      kind: "wearer_photo",
      providerFileKey: "same-key",
    });
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "same-key", media_asset_id: mediaId }])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      mediaAssetId: mediaId,
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("does not delete the previous file if saving fails", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "old-key", media_asset_id: "old-media" }])
      .mockRejectedValueOnce(new Error("db down"));
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      mediaAssetId: mediaId,
    });
    expect(res.ok).toBe(false);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("deletes the file when the photo is removed", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "old-key", media_asset_id: mediaId }])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await clearWearerPhoto("u1");
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).toHaveBeenCalledWith(["old-key"], "owner-token");
  });

  it("skips UploadThing when removing a row with no key", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await clearWearerPhoto("u1");
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });
});
