import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingTokenForConnection: vi.fn(),
}));

vi.mock("@/lib/uploadthing-server", () => ({
  deleteUploadThingFiles: vi.fn(),
}));

import {
  cleanupExpiredUnclaimedUploads,
  consumeUploadIntent,
} from "@/lib/media/intents";
import { resolveUploadThingTokenForConnection } from "@/lib/credentials/resolve";
import { requireSql } from "@/lib/db";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";

const requireSqlMock = vi.mocked(requireSql);
const resolveTokenMock = vi.mocked(resolveUploadThingTokenForConnection);
const deleteFilesMock = vi.mocked(deleteUploadThingFiles);

describe("consumeUploadIntent", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
  });

  it("records multiple closet files against one unconsumed intent", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "intent-1",
          connection_id: "conn-1",
          endpoint: "closetImage",
        },
      ])
      .mockResolvedValueOnce([{ id: "asset-1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "intent-1",
          connection_id: "conn-1",
          endpoint: "closetImage",
        },
      ])
      .mockResolvedValueOnce([{ id: "asset-2" }])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    await expect(
      consumeUploadIntent({
        intentId: "intent-1",
        userId: "u1",
        fileKey: "file-a",
        kind: "closet_image",
      }),
    ).resolves.toEqual({ mediaAssetId: "asset-1" });
    await expect(
      consumeUploadIntent({
        intentId: "intent-1",
        userId: "u1",
        fileKey: "file-b",
        kind: "closet_image",
      }),
    ).resolves.toEqual({ mediaAssetId: "asset-2" });
  });

  it("rejects a closet file against a wearer-photo intent", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: "intent-1",
        connection_id: "conn-1",
        endpoint: "wearerPhoto",
      },
    ]);
    requireSqlMock.mockReturnValue(sql as never);

    await expect(
      consumeUploadIntent({
        intentId: "intent-1",
        userId: "u1",
        fileKey: "file-a",
        kind: "closet_image",
      }),
    ).resolves.toBeNull();
  });

  it("consumes a wearer-photo intent in one statement", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ id: "asset-1" }]);
    requireSqlMock.mockReturnValue(sql as never);
    await expect(
      consumeUploadIntent({
        intentId: "intent-1",
        userId: "u1",
        fileKey: "file-a",
        kind: "wearer_photo",
      }),
    ).resolves.toEqual({ mediaAssetId: "asset-1" });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(String(sql.mock.calls[0]?.[0] ?? "")).toContain("WITH claimed AS");
  });
});

describe("cleanupExpiredUnclaimedUploads", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
    resolveTokenMock.mockReset();
    deleteFilesMock.mockReset();
  });

  function abandoned(connectionId: string | null, keys: string[]) {
    return keys.map((key, i) => ({
      id: `${connectionId ?? "platform"}-${i}`,
      connection_id: connectionId,
      provider_file_key: key,
    }));
  }

  /**
   * upload_intents.media_asset_id holds one id, so selecting through it only
   * ever reached the last file of a multi-file closet upload.
   */
  it("selects abandoned assets by age rather than through upload_intents", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    await cleanupExpiredUnclaimedUploads({ userId: "u1" });

    const query = String(sql.mock.calls[0]?.[0] ?? "");
    expect(query).not.toContain("upload_intents");
    expect(query).toContain("ma.created_at");
    // Legacy rows reference their file by key, not by media asset id.
    expect(query).toContain("g.uploadthing_key = ma.provider_file_key");
    expect(query).toContain("p.uploadthing_key = ma.provider_file_key");
  });

  it("deletes every abandoned file for the user in one provider call", async () => {
    const rows = abandoned(null, ["file-1", "file-2", "file-3"]);
    const sql = vi
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    resolveTokenMock.mockResolvedValue({
      ok: true,
      token: "t",
      connectionId: null,
      source: "platform_env",
    });
    deleteFilesMock.mockResolvedValue(true);

    await cleanupExpiredUnclaimedUploads({ userId: "u1" });

    expect(deleteFilesMock).toHaveBeenCalledTimes(1);
    expect(deleteFilesMock).toHaveBeenCalledWith(
      ["file-1", "file-2", "file-3"],
      "t",
    );
    // One token resolution for the whole batch, not one per file.
    expect(resolveTokenMock).toHaveBeenCalledTimes(1);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("resolves one token per connection when files span connections", async () => {
    const rows = [
      ...abandoned("conn-a", ["a1", "a2"]),
      ...abandoned("conn-b", ["b1"]),
    ];
    const sql = vi.fn().mockResolvedValueOnce(rows).mockResolvedValue(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    resolveTokenMock.mockResolvedValue({
      ok: true,
      token: "t",
      connectionId: null,
      source: "user_byok",
    });
    deleteFilesMock.mockResolvedValue(true);

    await cleanupExpiredUnclaimedUploads({ userId: "u1" });

    expect(resolveTokenMock).toHaveBeenCalledTimes(2);
    expect(deleteFilesMock).toHaveBeenNthCalledWith(1, ["a1", "a2"], "t");
    expect(deleteFilesMock).toHaveBeenNthCalledWith(2, ["b1"], "t");
  });

  it("keeps rows when the provider delete fails", async () => {
    const sql = vi.fn().mockResolvedValueOnce(abandoned(null, ["file-1"]));
    requireSqlMock.mockReturnValue(sql as never);
    resolveTokenMock.mockResolvedValue({
      ok: true,
      token: "t",
      connectionId: null,
      source: "platform_env",
    });
    deleteFilesMock.mockResolvedValue(false);

    await cleanupExpiredUnclaimedUploads({ userId: "u1" });

    // Only the select ran; the row survives so a later sweep can retry.
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("skips a connection whose token cannot be resolved", async () => {
    const sql = vi.fn().mockResolvedValueOnce(abandoned("conn-a", ["a1"]));
    requireSqlMock.mockReturnValue(sql as never);
    resolveTokenMock.mockResolvedValue({ ok: false, message: "nope" });

    await cleanupExpiredUnclaimedUploads({ userId: "u1" });

    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
