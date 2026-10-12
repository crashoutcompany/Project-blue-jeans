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
  getByokConnectionPublic,
  getStoredProviderCredential,
  revokeByokCredential,
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
      .mockResolvedValueOnce([
        { connection_id: "40fcae40-a6d7-48a6-b877-6f70317825f6" },
      ]);
    sqlMockFactory.mockReturnValue(sql as never);

    await saveByokCredential({
      userId: "wearer-1",
      provider: "google_ai_studio",
      secret: { apiKey: "google-secret" },
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
    expect(sqlValues).not.toContain("cret");
    // Write-only: no hint (or any other part of the key) is stored.
    const statements = sql.mock.calls
      .map((call) => (call[0] as string[]).join("?"))
      .join("\n");
    expect(statements).not.toContain("secret_hint");
  });

  it("reports a connection as having a credential without reading any key material", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        connection_id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
        status: "active",
        has_credential: true,
        tested_at: new Date("2026-08-18T12:00:00.000Z"),
      },
    ]);
    sqlMockFactory.mockReturnValue(sql as never);

    const connection = await getByokConnectionPublic(
      "wearer-1",
      "google_ai_studio",
    );
    expect(connection).toEqual({
      connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
      status: "active",
      hasCredential: true,
      testedAt: "2026-08-18T12:00:00.000Z",
    });
    const statement = (sql.mock.calls[0]![0] as string[]).join("?");
    expect(statement).not.toContain("secret_hint");
    expect(statement).not.toContain("ciphertext");
    expect(decryptMock).not.toHaveBeenCalled();
  });

  it("reports no credential when the connection has no live secret row", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        connection_id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
        status: "action_required",
        has_credential: false,
        tested_at: null,
      },
    ]);
    sqlMockFactory.mockReturnValue(sql as never);

    await expect(
      getByokConnectionPublic("wearer-1", "uploadthing"),
    ).resolves.toEqual({
      connectionId: "40fcae40-a6d7-48a6-b877-6f70317825f6",
      status: "action_required",
      hasCredential: false,
      testedAt: null,
    });
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

  it("rejects a save when a concurrent save bound a different app first", async () => {
    // The connection looked unbound when read, but the guarded write found it
    // bound to another app by the time it ran, so nothing was stored.
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "40fcae40-a6d7-48a6-b877-6f70317825f6",
          external_account_id: null,
        },
      ])
      .mockResolvedValueOnce([]);
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
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("deletes ciphertext on revoke instead of flagging it", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "40fcae40-a6d7-48a6-b877-6f70317825f6" }]);
    sqlMockFactory.mockReturnValue(sql as never);

    await expect(revokeByokCredential("wearer-1", "uploadthing")).resolves.toBe(
      true,
    );
    const statement = (sql.mock.calls[0]![0] as string[]).join("?");
    expect(statement).toContain("DELETE FROM provider_credentials");
    expect(statement).not.toContain("SET revoked_at");
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
