import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/validate-google-ai", () => ({
  validateGoogleAiStudioApiKey: vi.fn(),
}));

vi.mock("@/lib/credentials/validation-rate-limit", () => ({
  consumeValidationAttempt: vi.fn(),
  VALIDATION_RATE_LIMITED_MESSAGE: "Too many attempts. Try again in an hour.",
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
import { consumeValidationAttempt } from "@/lib/credentials/validation-rate-limit";
import {
  getByokConnectionPublic,
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";

const validateMock = vi.mocked(validateGoogleAiStudioApiKey);
const saveMock = vi.mocked(saveByokCredential);
const revokeMock = vi.mocked(revokeByokCredential);
const rateLimitMock = vi.mocked(consumeValidationAttempt);

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
    rateLimitMock.mockReset();
    rateLimitMock.mockResolvedValue(true);
    vi.mocked(googleAiStudioEnvApiKey).mockReturnValue("env-key");
  });

  it("stops before validating once the Wearer is rate limited", async () => {
    rateLimitMock.mockResolvedValue(false);

    await expect(saveGoogleAiStudioByok("wearer-1", wearer, "some-secret-value")).resolves.toEqual({
      ok: false,
      message: "Too many attempts. Try again in an hour.",
      rateLimited: true,
    });
    expect(rateLimitMock).toHaveBeenCalledWith("wearer-1", "google_ai_studio");
    expect(validateMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
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

  it("validates then encrypts a Wearer key without keeping any hint, never storing on failure", async () => {
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
    ).resolves.toEqual({ ok: true });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "wearer-1",
        provider: "google_ai_studio",
        secret: { apiKey: "AIza-good-key-1234" },
      }),
    );
    expect(saveMock.mock.calls[0]![0]).not.toHaveProperty("secretHint");
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
      testedAt: null,
    });

    validateMock.mockResolvedValueOnce({
      ok: true,
      apiKey: "AIza-wearer-key-9999",
    });
    saveMock.mockResolvedValue({ connectionId: "c1" });

    await expect(
      saveGoogleAiStudioByok("wearer-1", mislabeled, "AIza-wearer-key-9999"),
    ).resolves.toEqual({ ok: true });
    expect(saveMock).toHaveBeenCalled();
  });

  it("derives connected from an active connection with a stored credential", async () => {
    vi.mocked(getByokConnectionPublic).mockResolvedValue({
      connectionId: "c1",
      status: "active",
      hasCredential: true,
      testedAt: "2026-08-18T12:00:00.000Z",
    });

    const view = await getGoogleAiStudioSettings("wearer-1", wearer);
    expect(view).toEqual({
      funding: "byok",
      canEdit: true,
      connected: true,
      testedAt: "2026-08-18T12:00:00.000Z",
    });
    expect(view).not.toHaveProperty("secretHint");
  });

  it.each([
    { status: "active" as const, hasCredential: false },
    { status: "action_required" as const, hasCredential: true },
    { status: "disabled" as const, hasCredential: true },
  ])(
    "is not connected when status is $status and hasCredential is $hasCredential",
    async ({ status, hasCredential }) => {
      vi.mocked(getByokConnectionPublic).mockResolvedValue({
        connectionId: "c1",
        status,
        hasCredential,
        testedAt: "2026-08-18T12:00:00.000Z",
      });

      await expect(getGoogleAiStudioSettings("wearer-1", wearer)).resolves.toEqual({
        funding: "byok",
        canEdit: true,
        connected: false,
        testedAt: null,
      });
    },
  );
});
