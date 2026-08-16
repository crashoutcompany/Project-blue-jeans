import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

vi.mock("@/lib/uploadthing-server", () => ({
  deleteUploadThingFiles: vi.fn(),
}));

import { requireSql } from "@/lib/db";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";
import { clearWearerPhoto, saveWearerPhoto } from "@/lib/wearer/profile";

const requireSqlMock = vi.mocked(requireSql);
const deleteFilesMock = vi.mocked(deleteUploadThingFiles);

describe("wearer photo UploadThing cleanup", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
    deleteFilesMock.mockReset();
    deleteFilesMock.mockResolvedValue(undefined);
  });

  it("does not delete a file on first save", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      imageUrl: "https://ut.example/a.jpg",
      uploadthingKey: "new-key",
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("deletes the previous file when the photo is replaced", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "old-key" }])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      imageUrl: "https://ut.example/b.jpg",
      uploadthingKey: "new-key",
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).toHaveBeenCalledWith(["old-key"]);
  });

  it("keeps the file when the key is unchanged", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "same-key" }])
      .mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      imageUrl: "https://ut.example/a.jpg",
      uploadthingKey: "same-key",
    });
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("does not delete the previous file if saving fails", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ uploadthing_key: "old-key" }])
      .mockRejectedValueOnce(new Error("db down"));
    requireSqlMock.mockReturnValue(sql as never);

    const res = await saveWearerPhoto({
      userId: "u1",
      imageUrl: "https://ut.example/b.jpg",
      uploadthingKey: "new-key",
    });
    expect(res.ok).toBe(false);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("deletes the file when the photo is removed", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ uploadthing_key: "old-key" }]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await clearWearerPhoto("u1");
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).toHaveBeenCalledWith(["old-key"]);
  });

  it("skips UploadThing when removing a row with no key", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await clearWearerPhoto("u1");
    expect(res.ok).toBe(true);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });
});
