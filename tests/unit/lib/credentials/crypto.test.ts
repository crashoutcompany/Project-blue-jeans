import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  configuredCredentialKeyVersion,
  CredentialEncryptionError,
  decryptCredential,
  encryptCredential,
} from "@/lib/credentials/crypto";

const context = {
  userId: "wearer-1",
  provider: "google_ai_studio" as const,
  connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
};

describe("provider credential encryption", () => {
  const originalVersion = process.env.PROVIDER_CREDENTIAL_KEY_VERSION;
  const originalKey = process.env.PROVIDER_CREDENTIAL_KEY_V1;
  const originalKeyV2 = process.env.PROVIDER_CREDENTIAL_KEY_V2;

  beforeEach(() => {
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "1";
    process.env.PROVIDER_CREDENTIAL_KEY_V1 = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    if (originalVersion === undefined) {
      delete process.env.PROVIDER_CREDENTIAL_KEY_VERSION;
    } else {
      process.env.PROVIDER_CREDENTIAL_KEY_VERSION = originalVersion;
    }
    if (originalKey === undefined) {
      delete process.env.PROVIDER_CREDENTIAL_KEY_V1;
    } else {
      process.env.PROVIDER_CREDENTIAL_KEY_V1 = originalKey;
    }
    if (originalKeyV2 === undefined) {
      delete process.env.PROVIDER_CREDENTIAL_KEY_V2;
    } else {
      process.env.PROVIDER_CREDENTIAL_KEY_V2 = originalKeyV2;
    }
  });

  it("round-trips a secret without storing plaintext", () => {
    const encrypted = encryptCredential('{"apiKey":"secret-value"}', context);

    expect(Buffer.from(encrypted.ciphertext).toString("utf8")).not.toContain(
      "secret-value",
    );
    expect(decryptCredential(encrypted, context)).toBe(
      '{"apiKey":"secret-value"}',
    );
  });

  it("binds ciphertext to the owning user, provider, and connection", () => {
    const encrypted = encryptCredential("secret-value", context);

    expect(() =>
      decryptCredential(encrypted, { ...context, userId: "wearer-2" }),
    ).toThrow(
      expect.objectContaining<Partial<CredentialEncryptionError>>({
        code: "decryption_failed",
      }),
    );
  });

  it("rejects modified ciphertext", () => {
    const encrypted = encryptCredential("secret-value", context);
    const modified = Uint8Array.from(encrypted.ciphertext);
    modified[0] = (modified[0] ?? 0) ^ 1;

    expect(() =>
      decryptCredential({ ...encrypted, ciphertext: modified }, context),
    ).toThrow(
      expect.objectContaining<Partial<CredentialEncryptionError>>({
        code: "decryption_failed",
      }),
    );
  });

  it("requires an explicitly versioned 32-byte key", () => {
    process.env.PROVIDER_CREDENTIAL_KEY_V1 = "not-a-key";

    expect(() => encryptCredential("secret-value", context)).toThrow(
      expect.objectContaining<Partial<CredentialEncryptionError>>({
        code: "invalid_key",
      }),
    );
  });

  it("decrypts v1 ciphertext after the configured version advances to v2", () => {
    const encrypted = encryptCredential("secret-value", context);
    const v1 = process.env.PROVIDER_CREDENTIAL_KEY_V1!;
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "2";
    process.env.PROVIDER_CREDENTIAL_KEY_V2 = randomBytes(32).toString("base64");
    process.env.PROVIDER_CREDENTIAL_KEY_V1 = v1;

    expect(configuredCredentialKeyVersion()).toBe(2);
    expect(decryptCredential(encrypted, context)).toBe("secret-value");
  });
});
