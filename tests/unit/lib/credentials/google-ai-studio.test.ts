import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/validate-google-ai", () => ({
  validateGoogleAiStudioApiKey: vi.fn(),
}));

vi.mock("@/lib/credentials/vault", () => ({
  getByokConnectionPublic: vi.fn(),
  saveByokCredential: vi.fn(),
  revokeByokCredential: vi.fn(),
}));

vi.mock("@/lib/credentials/resolve", () => ({
  googleAiStudioEnvApiKey: vi.fn(),
}));

import {
  getGoogleAiStudioSettings,
  revokeGoogleAiStudioByok,
  saveGoogleAiStudioByok,
} from "@/lib/credentials/google-ai-studio";
import { googleAiStudioEnvApiKey } from "@/lib/credentials/resolve";
import { validateGoogleAiStudioApiKey } from "@/lib/credentials/validate-google-ai";
import {
  getByokConnectionPublic,
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";

const validateMock = vi.mocked(validateGoogleAiStudioApiKey);
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

describe("Google AI Studio BYOK mutations", () => {
  beforeEach(() => {
    validateMock.mockReset();
    saveMock.mockReset();
    revokeMock.mockReset();
    vi.mocked(googleAiStudioEnvApiKey).mockReturnValue("env-key");
  });

  it("does not save a platform-funded owner key", async () => {
    await expect(
      saveGoogleAiStudioByok("owner-1", owner, "AIza-should-not-save"),
    ).resolves.toEqual({
      ok: false,
      message:
        "Platform-funded accounts use the environment Google AI Studio key.",
    });
    expect(validateMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("validates then encrypts a Wearer key with a hint, never storing on failure", async () => {
    validateMock.mockResolvedValueOnce({
      ok: false,
      message: "That Google AI Studio key could not be verified.",
    });

    await expect(
      saveGoogleAiStudioByok("wearer-1", wearer, "AIza-bad"),
    ).resolves.toEqual({
      ok: false,
      message: "That Google AI Studio key could not be verified.",
    });
    expect(saveMock).not.toHaveBeenCalled();

    validateMock.mockResolvedValueOnce({
      ok: true,
      apiKey: "AIza-good-key-1234",
    });
    saveMock.mockResolvedValue({ connectionId: "c1" });

    await expect(
      saveGoogleAiStudioByok("wearer-1", wearer, "AIza-good-key-1234"),
    ).resolves.toEqual({ ok: true, secretHint: "…1234" });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "wearer-1",
        provider: "google_ai_studio",
        secret: { apiKey: "AIza-good-key-1234" },
        secretHint: "…1234",
      }),
    );
  });

  it("does not revoke the platform-funded owner connection", async () => {
    await expect(revokeGoogleAiStudioByok("owner-1", owner)).resolves.toEqual({
      ok: false,
      message:
        "Platform-funded accounts use the environment Google AI Studio key.",
    });
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("still treats a Wearer as BYOK if credentialSource is mislabeled", async () => {
    const mislabeled = {
      ...wearer,
      credentialSource: "platform_env" as const,
    };
    vi.mocked(getByokConnectionPublic).mockResolvedValue(null);

    await expect(
      getGoogleAiStudioSettings("wearer-1", mislabeled),
    ).resolves.toEqual({
      funding: "byok",
      canEdit: true,
      connected: false,
      secretHint: null,
      testedAt: null,
    });

    validateMock.mockResolvedValueOnce({
      ok: true,
      apiKey: "AIza-wearer-key-9999",
    });
    saveMock.mockResolvedValue({ connectionId: "c1" });

    await expect(
      saveGoogleAiStudioByok("wearer-1", mislabeled, "AIza-wearer-key-9999"),
    ).resolves.toEqual({ ok: true, secretHint: "…9999" });
    expect(saveMock).toHaveBeenCalled();
  });
});
