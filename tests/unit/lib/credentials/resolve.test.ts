import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/membership", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/membership")>();
  return {
    ...actual,
    getMembershipPolicy: vi.fn(),
  };
});

vi.mock("@/lib/credentials/vault", () => ({
  getStoredProviderCredential: vi.fn(),
  getStoredProviderCredentialByConnectionId: vi.fn(),
}));

import { getMembershipPolicy } from "@/lib/auth/membership";
import {
  ProviderCredentialUnavailableError,
  resolveGeminiApiKey,
  resolveProviderCredential,
  resolveUploadThingToken,
  resolveUploadThingTokenForConnection,
} from "@/lib/credentials/resolve";
import { getStoredProviderCredential } from "@/lib/credentials/vault";

const membershipMock = vi.mocked(getMembershipPolicy);
const storedCredentialMock = vi.mocked(getStoredProviderCredential);

const wearerByok = {
  userId: "wearer-1",
  accessRole: "wearer" as const,
  credentialSource: "user_byok" as const,
  status: "active" as const,
  persisted: true,
};

const ownerPlatform = {
  userId: "owner-1",
  accessRole: "owner" as const,
  credentialSource: "platform_env" as const,
  status: "active" as const,
  persisted: true,
};

describe("provider credential resolution", () => {
  const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalUploadThingToken = process.env.UPLOADTHING_TOKEN;
  const originalOwnerId = process.env.APP_OWNER_USER_ID;
  const originalE2e = process.env.E2E_PLAYWRIGHT;

  beforeEach(() => {
    membershipMock.mockReset();
    storedCredentialMock.mockReset();
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.UPLOADTHING_TOKEN;
    delete process.env.APP_OWNER_USER_ID;
    delete process.env.E2E_PLAYWRIGHT;
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
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
    if (originalE2e === undefined) {
      delete process.env.E2E_PLAYWRIGHT;
    } else {
      process.env.E2E_PLAYWRIGHT = originalE2e;
    }
  });

  it("uses the environment only for a platform-funded owner", async () => {
    membershipMock.mockResolvedValue(ownerPlatform);
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
    membershipMock.mockResolvedValue(wearerByok);
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
    membershipMock.mockResolvedValue(wearerByok);
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";
    process.env.UPLOADTHING_TOKEN = "platform-token";

    await expect(
      resolveProviderCredential("wearer-1", "google_ai_studio"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "byok_credential_missing",
      }),
    );
    await expect(resolveUploadThingToken("wearer-1")).resolves.toEqual({
      ok: false,
      message: "Connect UploadThing in Settings before uploading photos.",
    });
    expect(storedCredentialMock).toHaveBeenCalled();
  });

  it("never uses env keys for a Wearer labeled platform_env", async () => {
    membershipMock.mockResolvedValue({
      ...wearerByok,
      credentialSource: "platform_env",
    });
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";
    process.env.UPLOADTHING_TOKEN = "platform-token";

    await expect(
      resolveProviderCredential("wearer-1", "google_ai_studio"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "byok_credential_missing",
      }),
    );
    await expect(
      resolveUploadThingTokenForConnection("wearer-1", "connection-1"),
    ).resolves.toEqual({
      ok: false,
      message: "Connect UploadThing in Settings before uploading photos.",
    });
  });

  it("rejects a membership object that belongs to a different user", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";

    await expect(
      resolveProviderCredential("wearer-1", "google_ai_studio", ownerPlatform),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "not_admitted",
      }),
    );
    expect(storedCredentialMock).not.toHaveBeenCalled();
  });

  it("ignores an owner fallback when resolving credentials for another user", async () => {
    membershipMock.mockResolvedValue(null);
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";
    process.env.UPLOADTHING_TOKEN = "platform-token";

    await expect(
      resolveGeminiApiKey("wearer-1", ownerPlatform),
    ).resolves.toEqual({
      ok: false,
      message: "This account has not been admitted to Blue Jeans.",
    });
    await expect(
      resolveUploadThingToken("wearer-1", ownerPlatform),
    ).resolves.toEqual({
      ok: false,
      message: "This account has not been admitted to Blue Jeans.",
    });
  });

  it("does not bill the env keys when APP_OWNER_USER_ID is a different user", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    membershipMock.mockResolvedValue({
      userId: "other-owner",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: true,
    });
    storedCredentialMock.mockResolvedValue(null);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "platform-key";
    process.env.UPLOADTHING_TOKEN = "platform-token";

    await expect(
      resolveProviderCredential("other-owner", "google_ai_studio"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "byok_credential_missing",
      }),
    );
    await expect(resolveUploadThingToken("other-owner")).resolves.toEqual({
      ok: false,
      message: "Connect UploadThing in Settings before uploading photos.",
    });
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
      resolveProviderCredential("wearer-1", "google_ai_studio", wearerByok),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderCredentialUnavailableError>>({
        code: "byok_credential_missing",
      }),
    );
    expect(membershipMock).not.toHaveBeenCalled();
  });

  it("lets a stored membership win over an owner fallback when resolving Gemini", async () => {
    membershipMock.mockResolvedValue(wearerByok);
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
    membershipMock.mockResolvedValue(wearerByok);
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
