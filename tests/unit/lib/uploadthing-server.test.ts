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
    await deleteUploadThingFiles(["  ", ""]);
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("skips the API when the token is missing", async () => {
    delete process.env.UPLOADTHING_TOKEN;
    await deleteUploadThingFiles(["file-key"], undefined);
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(logServerError).toHaveBeenCalled();
  });

  it("deletes files through UTApi with an explicit token", async () => {
    await deleteUploadThingFiles(["file-key"], "explicit-token");
    expect(deleteFiles).toHaveBeenCalledWith(["file-key"]);
  });

  it("does not fall back to UPLOADTHING_TOKEN", async () => {
    process.env.UPLOADTHING_TOKEN = "tok";
    await deleteUploadThingFiles(["file-key"], undefined);
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(logServerError).toHaveBeenCalled();
  });
});
