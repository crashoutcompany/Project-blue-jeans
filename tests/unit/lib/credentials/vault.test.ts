import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/credentials/crypto", () => ({
  encryptCredential: vi.fn(),
  decryptCredential: vi.fn(),
  configuredCredentialKeyVersion: vi.fn(() => 1),
}));

import {
  configuredCredentialKeyVersion,
  decryptCredential,
  encryptCredential,
} from "@/lib/credentials/crypto";
import {
  CredentialVaultError,
  getStoredProviderCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";
import { requireSql } from "@/lib/db";

const sqlMockFactory = vi.mocked(requireSql);
const encryptMock = vi.mocked(encryptCredential);
const decryptMock = vi.mocked(decryptCredential);
const keyVersionMock = vi.mocked(configuredCredentialKeyVersion);

describe("provider credential vault", () => {
  beforeEach(() => {
    sqlMockFactory.mockReset();
    encryptMock.mockReset();
    decryptMock.mockReset();
    keyVersionMock.mockReset();
    keyVersionMock.mockReturnValue(1);
    encryptMock.mockReturnValue({
      ciphertext: Uint8Array.from([1, 2]),
      iv: Uint8Array.from([3, 4]),
      authTag: Uint8Array.from([5, 6]),
      keyVersion: 1,
    });
  });

  it("encrypts before persisting and never sends plaintext to SQL", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "40fcae40-a6d7-48a6-b877-6f70317825f6" },
      ])
      .mockResolvedValueOnce([]);
    sqlMockFactory.mockReturnValue(sql as never);

    await saveByokCredential({
      userId: "wearer-1",
      provider: "google_ai_studio",
      secret: { apiKey: "google-secret" },
      secretHint: "…cret",
      testedAt: new Date("2026-08-18T12:00:00.000Z"),
    });

    expect(encryptMock).toHaveBeenCalledWith(
      '{"apiKey":"google-secret"}',
      expect.objectContaining({
        userId: "wearer-1",
        provider: "google_ai_studio",
      }),
    );
    const sqlValues = sql.mock.calls.flatMap((call) => call.slice(1));
    expect(sqlValues).not.toContain("google-secret");
  });

  it("does not encrypt when no active BYOK membership exists", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    sqlMockFactory.mockReturnValue(sql as never);

    await expect(
      saveByokCredential({
        userId: "unknown",
        provider: "uploadthing",
        secret: { token: "token" },
        testedAt: new Date(),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CredentialVaultError>>({
        code: "membership_unavailable",
      }),
    );
    expect(encryptMock).not.toHaveBeenCalled();
  });

  it("decrypts with ownership context and validates the secret shape", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        connection_id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
        ciphertext: Uint8Array.from([1, 2]),
        iv: Uint8Array.from([3, 4]),
        auth_tag: Uint8Array.from([5, 6]),
        encryption_key_version: 1,
      },
    ]);
    sqlMockFactory.mockReturnValue(sql as never);
    decryptMock.mockReturnValue('{"token":"stored-token"}');

    await expect(
      getStoredProviderCredential("wearer-1", "uploadthing"),
    ).resolves.toEqual({
      connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
      secret: { token: "stored-token" },
    });
    expect(decryptMock).toHaveBeenCalledWith(
      expect.objectContaining({ keyVersion: 1 }),
      {
        userId: "wearer-1",
        provider: "uploadthing",
        connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
      },
    );
  });

  it("rejects a different provider account than the bound connection", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
        external_account_id: "app-a",
      },
    ]);
    sqlMockFactory.mockReturnValue(sql as never);

    await expect(
      saveByokCredential({
        userId: "wearer-1",
        provider: "uploadthing",
        secret: { token: "token-b" },
        externalAccountId: "app-b",
        testedAt: new Date("2026-08-18T12:00:00.000Z"),
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CredentialVaultError>>({
        code: "account_mismatch",
      }),
    );
    expect(encryptMock).not.toHaveBeenCalled();
  });

  it("maps decryption failures to a vault error without exposing internals", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        connection_id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
        ciphertext: Uint8Array.from([1, 2]),
        iv: Uint8Array.from([3, 4]),
        auth_tag: Uint8Array.from([5, 6]),
        encryption_key_version: 1,
      },
    ]);
    sqlMockFactory.mockReturnValue(sql as never);
    decryptMock.mockImplementation(() => {
      throw new Error("PROVIDER_CREDENTIAL_KEY_V1 is not configured.");
    });

    await expect(
      getStoredProviderCredential("wearer-1", "uploadthing"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CredentialVaultError>>({
        code: "invalid_stored_credential",
        message: "Stored provider credential could not be read.",
      }),
    );
  });

  it("rewraps ciphertext to the current key version after a successful read", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          connection_id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
          ciphertext: Uint8Array.from([1, 2]),
          iv: Uint8Array.from([3, 4]),
          auth_tag: Uint8Array.from([5, 6]),
          encryption_key_version: 1,
        },
      ])
      .mockResolvedValueOnce([]);
    sqlMockFactory.mockReturnValue(sql as never);
    decryptMock.mockReturnValue('{"token":"stored-token"}');
    keyVersionMock.mockReturnValue(2);
    encryptMock.mockReturnValue({
      ciphertext: Uint8Array.from([9, 9]),
      iv: Uint8Array.from([8, 8]),
      authTag: Uint8Array.from([7, 7]),
      keyVersion: 2,
    });

    await expect(
      getStoredProviderCredential("wearer-1", "uploadthing"),
    ).resolves.toEqual({
      connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
      secret: { token: "stored-token" },
    });
    expect(encryptMock).toHaveBeenCalledWith(
      '{"token":"stored-token"}',
      expect.objectContaining({
        connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
      }),
    );
    expect(sql).toHaveBeenCalledTimes(2);
  });
});
