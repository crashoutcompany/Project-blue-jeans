import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/validate-uploadthing", () => ({
  validateUploadThingToken: vi.fn(),
}));

vi.mock("@/lib/credentials/vault", () => ({
  getByokConnectionPublic: vi.fn(),
  saveByokCredential: vi.fn(),
  revokeByokCredential: vi.fn(),
}));

vi.mock("@/lib/credentials/resolve", () => ({
  uploadThingEnvToken: vi.fn(),
}));

import {
  revokeUploadThingByok,
  saveUploadThingByok,
} from "@/lib/credentials/uploadthing";
import { uploadThingEnvToken } from "@/lib/credentials/resolve";
import { validateUploadThingToken } from "@/lib/credentials/validate-uploadthing";
import {
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";

const validateMock = vi.mocked(validateUploadThingToken);
const saveMock = vi.mocked(saveByokCredential);
const revokeMock = vi.mocked(revokeByokCredential);

const wearer = {
  userId: "wearer-1",
  accessRole: "wearer" as const,
  credentialSource: "user_byok" as const,
  status: "active" as const,
  persisted: true,
};

const owner = {
  userId: "owner-1",
  accessRole: "owner" as const,
  credentialSource: "platform_env" as const,
  status: "active" as const,
  persisted: true,
};

describe("UploadThing BYOK mutations", () => {
  beforeEach(() => {
    validateMock.mockReset();
    saveMock.mockReset();
    revokeMock.mockReset();
    vi.mocked(uploadThingEnvToken).mockReturnValue("env-token");
  });

  it("does not save a platform-funded owner token", async () => {
    await expect(
      saveUploadThingByok("owner-1", owner, "token-should-not-save"),
    ).resolves.toEqual({
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    });
    expect(validateMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("validates then encrypts a Wearer token with a hint", async () => {
    validateMock.mockResolvedValueOnce({
      ok: true,
      token: "wearer-token-1234",
      appId: "app-wearer",
    });
    saveMock.mockResolvedValue({ connectionId: "c1" });

    await expect(
      saveUploadThingByok("wearer-1", wearer, "wearer-token-1234"),
    ).resolves.toEqual({ ok: true, secretHint: "…1234" });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "wearer-1",
        provider: "uploadthing",
        secret: { token: "wearer-token-1234" },
        externalAccountId: "app-wearer",
        secretHint: "…1234",
      }),
    );
  });

  it("does not revoke the platform-funded owner connection", async () => {
    await expect(revokeUploadThingByok("owner-1", owner)).resolves.toEqual({
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    });
    expect(revokeMock).not.toHaveBeenCalled();
  });
});
