import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
  getSql: vi.fn(),
}));

import { consumeUploadIntent } from "@/lib/media/intents";
import { requireSql } from "@/lib/db";

const requireSqlMock = vi.mocked(requireSql);

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
