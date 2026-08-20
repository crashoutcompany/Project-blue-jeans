import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import type { ProviderKind } from "@/lib/credentials/types";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const AAD_VERSION = 1;
const KEY_VERSION_ENV = "PROVIDER_CREDENTIAL_KEY_VERSION";
const KEY_ENV_PREFIX = "PROVIDER_CREDENTIAL_KEY_V";
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type CredentialCiphertext = {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
  keyVersion: number;
};

type CredentialContext = {
  userId: string;
  connectionId: string;
  provider: ProviderKind;
};

export class CredentialEncryptionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_context"
      | "invalid_key_version"
      | "missing_key"
      | "invalid_key"
      | "decryption_failed",
  ) {
    super(message);
    this.name = "CredentialEncryptionError";
  }
}

function requiredContextValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CredentialEncryptionError(
      `Credential encryption context is missing ${field}.`,
      "invalid_context",
    );
  }
  return normalized;
}

function additionalAuthenticatedData(context: CredentialContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      "blue-jeans-provider-credential",
      AAD_VERSION,
      requiredContextValue(context.userId, "userId"),
      context.provider,
      requiredContextValue(context.connectionId, "connectionId"),
    ]),
    "utf8",
  );
}

function parseKeyVersion(raw: string | undefined): number {
  const normalized = raw?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new CredentialEncryptionError(
      `${KEY_VERSION_ENV} must be a positive integer.`,
      "invalid_key_version",
    );
  }
  return Number(normalized);
}

function masterKey(version: number): Buffer {
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new CredentialEncryptionError(
      "Credential encryption key version is invalid.",
      "invalid_key_version",
    );
  }

  const envName = `${KEY_ENV_PREFIX}${version}`;
  const encoded = process.env[envName]?.trim();
  if (!encoded) {
    throw new CredentialEncryptionError(
      `${envName} is not configured.`,
      "missing_key",
    );
  }
  if (!BASE64_PATTERN.test(encoded)) {
    throw new CredentialEncryptionError(
      `${envName} must be a base64-encoded 32-byte key.`,
      "invalid_key",
    );
  }

  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw new CredentialEncryptionError(
      `${envName} must decode to exactly ${KEY_BYTES} bytes.`,
      "invalid_key",
    );
  }
  return decoded;
}

export function configuredCredentialKeyVersion(): number {
  return parseKeyVersion(process.env[KEY_VERSION_ENV]);
}

export function encryptCredential(
  plaintext: string,
  context: CredentialContext,
): CredentialCiphertext {
  const keyVersion = configuredCredentialKeyVersion();
  const key = masterKey(keyVersion);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(additionalAuthenticatedData(context));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext,
    iv,
    authTag: cipher.getAuthTag(),
    keyVersion,
  };
}

export function decryptCredential(
  encrypted: CredentialCiphertext,
  context: CredentialContext,
): string {
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      masterKey(encrypted.keyVersion),
      encrypted.iv,
    );
    decipher.setAAD(additionalAuthenticatedData(context));
    decipher.setAuthTag(encrypted.authTag);
    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof CredentialEncryptionError) throw error;
    throw new CredentialEncryptionError(
      "Stored provider credential could not be decrypted.",
      "decryption_failed",
    );
  }
}
