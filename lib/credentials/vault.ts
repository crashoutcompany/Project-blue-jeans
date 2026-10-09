import "server-only";

import { z } from "zod";

import {
  configuredCredentialKeyVersion,
  decryptCredential,
  encryptCredential,
} from "@/lib/credentials/crypto";
import type {
  ProviderKind,
  ProviderSecretByKind,
} from "@/lib/credentials/types";
import { requireSql } from "@/lib/db";

const googleSecretSchema = z.object({ apiKey: z.string().trim().min(1) });
const uploadThingSecretSchema = z.object({ token: z.string().trim().min(1) });

const secretSchemas = {
  google_ai_studio: googleSecretSchema,
  uploadthing: uploadThingSecretSchema,
} satisfies Record<ProviderKind, z.ZodType>;

type StoredCredentialRow = {
  connection_id: string;
  ciphertext: Uint8Array | string;
  iv: Uint8Array | string;
  auth_tag: Uint8Array | string;
  encryption_key_version: number;
};

export class CredentialVaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_secret"
      | "membership_unavailable"
      | "credential_not_found"
      | "invalid_stored_credential"
      | "account_mismatch",
  ) {
    super(message);
    this.name = "CredentialVaultError";
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CredentialVaultError(
      `${field} is required.`,
      "invalid_secret",
    );
  }
  return normalized;
}

function parseSecret<P extends ProviderKind>(
  provider: P,
  value: unknown,
): ProviderSecretByKind[P] {
  const parsed = secretSchemas[provider].safeParse(value);
  if (!parsed.success) {
    throw new CredentialVaultError(
      `Stored ${provider} credential has an invalid shape.`,
      "invalid_stored_credential",
    );
  }
  return parsed.data as ProviderSecretByKind[P];
}

function serializeSecret<P extends ProviderKind>(
  provider: P,
  value: ProviderSecretByKind[P],
): string {
  const parsed = secretSchemas[provider].safeParse(value);
  if (!parsed.success) {
    throw new CredentialVaultError(
      `${provider} credential is empty or invalid.`,
      "invalid_secret",
    );
  }
  return JSON.stringify(parsed.data);
}

function storedPlaintext(plaintext: string): unknown {
  try {
    return JSON.parse(plaintext);
  } catch {
    throw new CredentialVaultError(
      "Stored provider credential is not valid JSON.",
      "invalid_stored_credential",
    );
  }
}

function decryptStoredSecret<P extends ProviderKind>(
  row: StoredCredentialRow,
  userId: string,
  provider: P,
): { plaintext: string; secret: ProviderSecretByKind[P] } {
  let plaintext: string;
  try {
    plaintext = decryptCredential(
      {
        ciphertext: bytes(row.ciphertext, "ciphertext"),
        iv: bytes(row.iv, "iv"),
        authTag: bytes(row.auth_tag, "auth tag"),
        keyVersion: row.encryption_key_version,
      },
      { userId, provider, connectionId: row.connection_id },
    );
  } catch (error) {
    if (error instanceof CredentialVaultError) throw error;
    throw new CredentialVaultError(
      "Stored provider credential could not be read.",
      "invalid_stored_credential",
    );
  }
  return {
    plaintext,
    secret: parseSecret(provider, storedPlaintext(plaintext)),
  };
}

function bytes(value: Uint8Array | string, field: string): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (/^\\x[0-9a-f]+$/i.test(value)) {
    return Buffer.from(value.slice(2), "hex");
  }
  throw new CredentialVaultError(
    `Stored provider credential has an invalid ${field}.`,
    "invalid_stored_credential",
  );
}

export async function saveByokCredential<P extends ProviderKind>(input: {
  userId: string;
  provider: P;
  secret: ProviderSecretByKind[P];
  externalAccountId?: string | null;
  testedAt: Date;
}): Promise<{ connectionId: string }> {
  const userId = required(input.userId, "userId");
  const serialized = serializeSecret(input.provider, input.secret);
  const externalAccountId = input.externalAccountId?.trim() || null;
  const testedAt = input.testedAt.toISOString();
  const sql = requireSql();

  const connections = (await sql`
    INSERT INTO provider_connections (
      user_id,
      provider,
      credential_source,
      status,
      external_account_id,
      is_default
    )
    SELECT
      user_id,
      ${input.provider}::provider_kind,
      credential_source,
      'action_required'::provider_connection_status,
      NULL,
      true
    FROM wearer_memberships
    WHERE user_id = ${userId}
      AND credential_source = 'user_byok'
      AND status = 'active'
    ON CONFLICT (user_id, provider) WHERE is_default = true
    DO UPDATE SET updated_at = now()
    RETURNING id, external_account_id
  `) as Array<{ id: string; external_account_id: string | null }>;

  const connection = connections[0];
  if (!connection) {
    throw new CredentialVaultError(
      "An active BYOK membership is required before saving provider credentials.",
      "membership_unavailable",
    );
  }

  const existingAccountId = connection.external_account_id?.trim() || null;
  if (
    existingAccountId &&
    externalAccountId &&
    existingAccountId !== externalAccountId
  ) {
    throw new CredentialVaultError(
      "That provider account is already bound to a different app.",
      "account_mismatch",
    );
  }

  const encrypted = encryptCredential(serialized, {
    userId,
    provider: input.provider,
    connectionId: connection.id,
  });

  /**
   * One statement binds the account and writes the ciphertext. The UPDATE
   * row-locks the connection, so a concurrent save for a different app
   * re-checks `external_account_id` after the first commits and writes
   * nothing, instead of storing app B's token on a connection bound to app A.
   */
  const saved = (await sql`
    WITH bound AS (
      UPDATE provider_connections pc
      SET
        status = 'active',
        last_validated_at = ${testedAt}::timestamptz,
        external_account_id = COALESCE(
          pc.external_account_id,
          ${externalAccountId}::text
        ),
        updated_at = now()
      WHERE pc.id = ${connection.id}::uuid
        AND pc.user_id = ${userId}
        AND pc.credential_source = 'user_byok'
        AND (
          ${externalAccountId}::text IS NULL
          OR pc.external_account_id IS NULL
          OR pc.external_account_id = ${externalAccountId}::text
        )
        AND EXISTS (
          SELECT 1 FROM wearer_memberships membership
          WHERE membership.user_id = pc.user_id
            AND membership.credential_source = 'user_byok'
            AND membership.status = 'active'
        )
      RETURNING pc.id
    )
    INSERT INTO provider_credentials (
      connection_id,
      ciphertext,
      iv,
      auth_tag,
      encryption_key_version,
      tested_at
    )
    SELECT
      bound.id,
      ${encrypted.ciphertext},
      ${encrypted.iv},
      ${encrypted.authTag},
      ${encrypted.keyVersion},
      ${testedAt}::timestamptz
    FROM bound
    ON CONFLICT (connection_id) WHERE revoked_at IS NULL
    DO UPDATE SET
      ciphertext = EXCLUDED.ciphertext,
      iv = EXCLUDED.iv,
      auth_tag = EXCLUDED.auth_tag,
      encryption_key_version = EXCLUDED.encryption_key_version,
      tested_at = EXCLUDED.tested_at,
      updated_at = now()
    RETURNING connection_id
  `) as Array<{ connection_id: string }>;

  if (!saved[0]) {
    throw externalAccountId
      ? new CredentialVaultError(
          "That provider account is already bound to a different app.",
          "account_mismatch",
        )
      : new CredentialVaultError(
          "An active BYOK membership is required before saving provider credentials.",
          "membership_unavailable",
        );
  }

  return { connectionId: connection.id };
}

export async function getStoredProviderCredential<P extends ProviderKind>(
  userIdInput: string,
  provider: P,
): Promise<{
  connectionId: string;
  secret: ProviderSecretByKind[P];
} | null> {
  const userId = required(userIdInput, "userId");
  const sql = requireSql();
  const rows = (await sql`
    SELECT
      pc.id AS connection_id,
      secret.ciphertext,
      secret.iv,
      secret.auth_tag,
      secret.encryption_key_version
    FROM provider_connections pc
    JOIN wearer_memberships membership
      ON membership.user_id = pc.user_id
    JOIN provider_credentials secret
      ON secret.connection_id = pc.id
      AND secret.revoked_at IS NULL
    WHERE pc.user_id = ${userId}
      AND pc.provider = ${provider}::provider_kind
      AND pc.credential_source = 'user_byok'
      AND pc.status = 'active'
      AND pc.is_default = true
      AND membership.status = 'active'
      AND membership.credential_source = 'user_byok'
    LIMIT 1
  `) as StoredCredentialRow[];

  const row = rows[0];
  if (!row) return null;
  const { plaintext, secret } = decryptStoredSecret(row, userId, provider);

  try {
    const currentVersion = configuredCredentialKeyVersion();
    if (currentVersion !== row.encryption_key_version) {
      const encrypted = encryptCredential(plaintext, {
        userId,
        provider,
        connectionId: row.connection_id,
      });
      await sql`
        UPDATE provider_credentials
        SET
          ciphertext = ${encrypted.ciphertext},
          iv = ${encrypted.iv},
          auth_tag = ${encrypted.authTag},
          encryption_key_version = ${encrypted.keyVersion},
          updated_at = now()
        WHERE connection_id = ${row.connection_id}::uuid
          AND revoked_at IS NULL
          AND encryption_key_version = ${row.encryption_key_version}
      `;
    }
  } catch (error) {
    console.error("[credentials] lazy rewrap failed", error);
  }

  return {
    connectionId: row.connection_id,
    secret,
  };
}

export async function getStoredProviderCredentialByConnectionId<
  P extends ProviderKind,
>(
  userIdInput: string,
  connectionIdInput: string,
  provider: P,
): Promise<{
  connectionId: string;
  secret: ProviderSecretByKind[P];
} | null> {
  const userId = required(userIdInput, "userId");
  const connectionId = required(connectionIdInput, "connectionId");
  const sql = requireSql();
  const rows = (await sql`
    SELECT
      pc.id AS connection_id,
      secret.ciphertext,
      secret.iv,
      secret.auth_tag,
      secret.encryption_key_version
    FROM provider_connections pc
    JOIN wearer_memberships membership
      ON membership.user_id = pc.user_id
    JOIN provider_credentials secret
      ON secret.connection_id = pc.id
      AND secret.revoked_at IS NULL
    WHERE pc.id = ${connectionId}::uuid
      AND pc.user_id = ${userId}
      AND pc.provider = ${provider}::provider_kind
      AND pc.credential_source = 'user_byok'
      AND membership.status = 'active'
      AND membership.credential_source = 'user_byok'
    LIMIT 1
  `) as StoredCredentialRow[];

  const row = rows[0];
  if (!row) return null;
  const { secret } = decryptStoredSecret(row, userId, provider);
  return {
    connectionId: row.connection_id,
    secret,
  };
}

export async function revokeByokCredential(
  userIdInput: string,
  provider: ProviderKind,
): Promise<boolean> {
  const userId = required(userIdInput, "userId");
  const sql = requireSql();
  // Delete rather than flag: a disconnected key should not stay decryptable
  // by anyone holding a database copy and the master key.
  const rows = (await sql`
    WITH revoked AS (
      DELETE FROM provider_credentials secret
      USING provider_connections connection
      WHERE connection.id = secret.connection_id
        AND connection.user_id = ${userId}
        AND connection.provider = ${provider}::provider_kind
        AND connection.credential_source = 'user_byok'
        AND connection.is_default = true
      RETURNING secret.id
    )
    UPDATE provider_connections
    SET status = 'action_required', updated_at = now()
    WHERE user_id = ${userId}
      AND provider = ${provider}::provider_kind
      AND credential_source = 'user_byok'
      AND is_default = true
      AND EXISTS (SELECT 1 FROM revoked)
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

/**
 * What the app may say about a stored credential. Keys are write-only: no
 * part of the secret (not even a last-4 hint) is ever read back out.
 */
export type PublicByokConnection = {
  connectionId: string;
  status: "active" | "action_required" | "disabled";
  hasCredential: boolean;
  testedAt: string | null;
};

export async function getByokConnectionPublic(
  userIdInput: string,
  provider: ProviderKind,
): Promise<PublicByokConnection | null> {
  const userId = required(userIdInput, "userId");
  const sql = requireSql();
  const rows = (await sql`
    SELECT
      pc.id AS connection_id,
      pc.status::text AS status,
      secret.id IS NOT NULL AS has_credential,
      secret.tested_at
    FROM provider_connections pc
    LEFT JOIN provider_credentials secret
      ON secret.connection_id = pc.id
      AND secret.revoked_at IS NULL
    WHERE pc.user_id = ${userId}
      AND pc.provider = ${provider}::provider_kind
      AND pc.credential_source = 'user_byok'
      AND pc.is_default = true
    LIMIT 1
  `) as Array<{
    connection_id: string;
    status: PublicByokConnection["status"];
    has_credential: boolean;
    tested_at: Date | string | null;
  }>;

  const row = rows[0];
  if (!row) return null;

  const testedAt =
    row.tested_at instanceof Date
      ? row.tested_at.toISOString()
      : row.tested_at;

  return {
    connectionId: row.connection_id,
    status: row.status,
    hasCredential: row.has_credential === true,
    testedAt,
  };
}
