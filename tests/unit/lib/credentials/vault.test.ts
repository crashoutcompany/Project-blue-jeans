import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/credentials/crypto", () => ({
  encryptCredential: vi.fn(),
  decryptCredential: vi.fn(),
}));

import {
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

describe("provider credential vault", () => {
  beforeEach(() => {
    sqlMockFactory.mockReset();
    encryptMock.mockReset();
    decryptMock.mockReset();
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
});
