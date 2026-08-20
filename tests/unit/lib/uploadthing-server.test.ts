import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteFiles = vi.fn();

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = deleteFiles;
  },
}));

vi.mock("@/lib/server/safe-client-error", () => ({
  logServerError: vi.fn(),
}));

import { logServerError } from "@/lib/server/safe-client-error";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";

describe("deleteUploadThingFiles", () => {
  const originalToken = process.env.UPLOADTHING_TOKEN;

  beforeEach(() => {
    deleteFiles.mockReset();
    deleteFiles.mockResolvedValue(undefined);
    vi.mocked(logServerError).mockReset();
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.UPLOADTHING_TOKEN;
    } else {
      process.env.UPLOADTHING_TOKEN = originalToken;
    }
  });

  it("no-ops when keys are empty", async () => {
    process.env.UPLOADTHING_TOKEN = "tok";
    await expect(deleteUploadThingFiles(["  ", ""])).resolves.toBe(true);
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("skips the API when the token is missing", async () => {
    delete process.env.UPLOADTHING_TOKEN;
    await expect(deleteUploadThingFiles(["file-key"], undefined)).resolves.toBe(
      false,
    );
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(logServerError).toHaveBeenCalled();
  });

  it("deletes files through UTApi with an explicit token", async () => {
    await expect(
      deleteUploadThingFiles(["file-key"], "explicit-token"),
    ).resolves.toBe(true);
    expect(deleteFiles).toHaveBeenCalledWith(["file-key"]);
  });

  it("does not fall back to UPLOADTHING_TOKEN", async () => {
    process.env.UPLOADTHING_TOKEN = "tok";
    await expect(deleteUploadThingFiles(["file-key"], undefined)).resolves.toBe(
      false,
    );
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(logServerError).toHaveBeenCalled();
  });

  it("returns false when UTApi throws", async () => {
    deleteFiles.mockRejectedValue(new Error("ut down"));
    await expect(
      deleteUploadThingFiles(["file-key"], "explicit-token"),
    ).resolves.toBe(false);
  });
});
