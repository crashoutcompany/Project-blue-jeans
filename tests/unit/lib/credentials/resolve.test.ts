import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/membership", () => ({
  getMembershipPolicy: vi.fn(),
}));

vi.mock("@/lib/credentials/vault", () => ({
  getStoredProviderCredential: vi.fn(),
}));

import { getMembershipPolicy } from "@/lib/auth/membership";
import {
  ProviderCredentialUnavailableError,
  resolveGeminiApiKey,
  resolveProviderCredential,
} from "@/lib/credentials/resolve";
import { getStoredProviderCredential } from "@/lib/credentials/vault";

const membershipMock = vi.mocked(getMembershipPolicy);
const storedCredentialMock = vi.mocked(getStoredProviderCredential);

describe("provider credential resolution", () => {
  const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalUploadThingToken = process.env.UPLOADTHING_TOKEN;

  beforeEach(() => {
    membershipMock.mockReset();
    storedCredentialMock.mockReset();
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.UPLOADTHING_TOKEN;
  });

  afterEach(() => {
    if (originalGoogleKey === undefined) {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    } else {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
    }
    if (originalUploadThingToken === undefined) {
      delete process.env.UPLOADTHING_TOKEN;
    } else {
      process.env.UPLOADTHING_TOKEN = originalUploadThingToken;
    }
  });

  it("uses the environment only for a platform-funded owner", async () => {
    membershipMock.mockResolvedValue({
      userId: "owner-1",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: true,
    });
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = '"owner-google-key"';

    await expect(
      resolveProviderCredential("owner-1", "google_ai_studio"),
    ).resolves.toEqual({
      provider: "google_ai_studio",
      source: "platform_env",
      connectionId: null,
      secret: { apiKey: "owner-google-key" },
    });
    expect(storedCredentialMock).not.toHaveBeenCalled();
  });

  it("loads an admitted Wearer's encrypted BYOK credential", async () => {
    membershipMock.mockResolvedValue({
      userId: "wearer-1",
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    });
    storedCredentialMock.mockResolvedValue({
      connectionId: "connection-1",
      secret: { token: "wearer-token" },
    } as never);

    await expect(
      resolveProviderCredential("wearer-1", "uploadthing"),
    ).resolves.toEqual({
      provider: "uploadthing",
      source: "user_byok",
      connectionId: "connection-1",
      secret: { token: "wearer-token" },
    });
  });

  it("never falls back to the platform key for a Wearer", async () => {
    membershipMock.mockResolvedValue({
      userId: "wearer-1",
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    });
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";

    await expect(
      resolveProviderCredential("wearer-1", "google_ai_studio"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "byok_credential_missing",
      }),
    );
  });

  it("rejects accounts that are not admitted", async () => {
    membershipMock.mockResolvedValue(null);

    await expect(
      resolveProviderCredential("unknown", "google_ai_studio"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "not_admitted",
      }),
    );
  });

  it("uses an explicit membership without reading the platform key for Wearers", async () => {
    membershipMock.mockResolvedValue(null);
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";

    await expect(
      resolveProviderCredential("wearer-1", "google_ai_studio", {
        userId: "wearer-1",
        accessRole: "wearer",
        credentialSource: "user_byok",
        status: "active",
        persisted: true,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "byok_credential_missing",
      }),
    );
    expect(membershipMock).not.toHaveBeenCalled();
  });

  it("lets a stored membership win over an owner fallback when resolving Gemini", async () => {
    membershipMock.mockResolvedValue({
      userId: "wearer-1",
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    });
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";

    await expect(
      resolveGeminiApiKey("wearer-1", {
        userId: "wearer-1",
        accessRole: "owner",
        credentialSource: "platform_env",
        status: "active",
        persisted: false,
      }),
    ).resolves.toEqual({
      ok: false,
      message:
        "Connect Google AI Studio in Settings before using this feature.",
    });
  });

  it("returns a safe client message when stored credentials cannot be decrypted", async () => {
    membershipMock.mockResolvedValue({
      userId: "wearer-1",
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    });
    storedCredentialMock.mockRejectedValue(
      new Error("PROVIDER_CREDENTIAL_KEY_V1 is not configured."),
    );

    await expect(resolveGeminiApiKey("wearer-1")).resolves.toEqual({
      ok: false,
      message:
        "Google AI Studio credentials could not be read. Try again in a moment.",
    });
  });
});
