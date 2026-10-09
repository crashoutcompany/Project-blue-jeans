import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadFiles } = vi.hoisted(() => ({ uploadFiles: vi.fn() }));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/media/resolve-upload-session", () => ({
  resolveUploadSession: vi.fn(),
}));

vi.mock("@/lib/media/uploadthing-api", () => ({
  createUploadThingApi: vi.fn(() => ({ uploadFiles })),
}));

vi.mock("@/lib/uploadthing-server", () => ({
  deleteUploadThingFiles: vi.fn(),
}));

import { requireSql } from "@/lib/db";
import { createHeroImageStore } from "@/lib/media/hero-assets";
import { resolveUploadSession } from "@/lib/media/resolve-upload-session";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";

const sqlRequire = vi.mocked(requireSql);
const uploadSession = vi.mocked(resolveUploadSession);
const deleteFiles = vi.mocked(deleteUploadThingFiles);

const ASSET_ID = "0a8f3c1e-9b6d-4e2a-8c1f-3d5e7a9b1c2d";
const CONNECTION_ID = "1b9f4d2e-8c7e-4f3b-9d2a-4e6f8b0c2d3e";
const image = { mediaType: "image/png", bytes: new Uint8Array([1, 2, 3]) };

describe("createHeroImageStore", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sqlRequire.mockReset();
    uploadSession.mockReset();
    uploadFiles.mockReset();
    deleteFiles.mockReset();
    uploadSession.mockResolvedValue({
      ok: true,
      token: "ut-token",
      connectionId: CONNECTION_ID,
    });
  });

  it("uploads the hero and returns its owned media path", async () => {
    uploadFiles.mockResolvedValue({ data: { key: "file-key" }, error: null });
    const sql = vi.fn().mockResolvedValue([{ id: ASSET_ID }]);
    sqlRequire.mockReturnValue(sql as never);

    const store = createHeroImageStore("u1");
    await expect(store(image)).resolves.toBe(`/api/media/${ASSET_ID}`);

    const text = (sql.mock.calls[0]![0] as TemplateStringsArray).join(" ");
    expect(text).toContain("'outfit_hero'::media_kind");
    expect(sql.mock.calls[0]!.slice(1)).toEqual([
      "u1",
      CONNECTION_ID,
      "file-key",
    ]);
  });

  it("resolves the upload session once per store", async () => {
    uploadFiles.mockResolvedValue({ data: { key: "file-key" }, error: null });
    sqlRequire.mockReturnValue(
      vi.fn().mockResolvedValue([{ id: ASSET_ID }]) as never,
    );

    const store = createHeroImageStore("u1");
    await Promise.all([store(image), store(image), store(image)]);

    expect(uploadSession).toHaveBeenCalledTimes(1);
  });

  it("returns null without uploading when no upload session is available", async () => {
    uploadSession.mockResolvedValue({ ok: false, message: "Connect UploadThing" });

    await expect(createHeroImageStore("u1")(image)).resolves.toBeNull();
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it("deletes the uploaded file when the media row cannot be written", async () => {
    uploadFiles.mockResolvedValue({ data: { key: "file-key" }, error: null });
    sqlRequire.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("db down")) as never,
    );

    await expect(createHeroImageStore("u1")(image)).resolves.toBeNull();
    expect(deleteFiles).toHaveBeenCalledWith(["file-key"], "ut-token");
  });

  it("returns null when the upload fails", async () => {
    uploadFiles.mockResolvedValue({
      data: null,
      error: { message: "quota exceeded" },
    });

    await expect(createHeroImageStore("u1")(image)).resolves.toBeNull();
    expect(deleteFiles).not.toHaveBeenCalled();
  });
});
