import "server-only";

import { z } from "zod";

import {
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
      | "invalid_stored_credential",
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
  secretHint?: string | null;
  externalAccountId?: string | null;
  testedAt: Date;
}): Promise<{ connectionId: string }> {
  const userId = required(input.userId, "userId");
  const serialized = serializeSecret(input.provider, input.secret);
  const sql = requireSql();
  const connections = (await sql`
    INSERT INTO provider_connections (
      user_id,
      provider,
      credential_source,
      status,
      external_account_id,
      is_default,
      last_validated_at
    )
    SELECT
      user_id,
      ${input.provider}::provider_kind,
      credential_source,
      'active'::provider_connection_status,
      ${input.externalAccountId?.trim() || null},
      true,
      ${input.testedAt.toISOString()}::timestamptz
    FROM wearer_memberships
    WHERE user_id = ${userId}
      AND credential_source = 'user_byok'
      AND status = 'active'
    ON CONFLICT (user_id, provider) WHERE is_default = true
    DO UPDATE SET
      status = 'active',
      external_account_id = COALESCE(
        EXCLUDED.external_account_id,
        provider_connections.external_account_id
      ),
      last_validated_at = EXCLUDED.last_validated_at,
      updated_at = now()
    RETURNING id
  `) as Array<{ id: string }>;

  const connectionId = connections[0]?.id;
  if (!connectionId) {
    throw new CredentialVaultError(
      "An active BYOK membership is required before saving provider credentials.",
      "membership_unavailable",
    );
  }

  const encrypted = encryptCredential(serialized, {
    userId,
    provider: input.provider,
    connectionId,
  });

  await sql`
    INSERT INTO provider_credentials (
      connection_id,
      ciphertext,
      iv,
      auth_tag,
      encryption_key_version,
      secret_hint,
      tested_at
    )
    VALUES (
      ${connectionId}::uuid,
      ${encrypted.ciphertext},
      ${encrypted.iv},
      ${encrypted.authTag},
      ${encrypted.keyVersion},
      ${input.secretHint?.trim() || null},
      ${input.testedAt.toISOString()}::timestamptz
    )
    ON CONFLICT (connection_id) WHERE revoked_at IS NULL
    DO UPDATE SET
      ciphertext = EXCLUDED.ciphertext,
      iv = EXCLUDED.iv,
      auth_tag = EXCLUDED.auth_tag,
      encryption_key_version = EXCLUDED.encryption_key_version,
      secret_hint = EXCLUDED.secret_hint,
      tested_at = EXCLUDED.tested_at,
      updated_at = now()
  `;

  return { connectionId };
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

  const plaintext = decryptCredential(
    {
      ciphertext: bytes(row.ciphertext, "ciphertext"),
      iv: bytes(row.iv, "iv"),
      authTag: bytes(row.auth_tag, "auth tag"),
      keyVersion: row.encryption_key_version,
    },
    { userId, provider, connectionId: row.connection_id },
  );

  try {
    return {
      connectionId: row.connection_id,
      secret: parseSecret(provider, JSON.parse(plaintext)),
    };
  } catch (error) {
    if (error instanceof CredentialVaultError) throw error;
    throw new CredentialVaultError(
      "Stored provider credential is not valid JSON.",
      "invalid_stored_credential",
    );
  }
}

export async function revokeByokCredential(
  userIdInput: string,
  provider: ProviderKind,
): Promise<boolean> {
  const userId = required(userIdInput, "userId");
  const sql = requireSql();
  const rows = (await sql`
    WITH revoked AS (
      UPDATE provider_credentials secret
      SET revoked_at = now(), updated_at = now()
      FROM provider_connections connection
      WHERE connection.id = secret.connection_id
        AND connection.user_id = ${userId}
        AND connection.provider = ${provider}::provider_kind
        AND connection.credential_source = 'user_byok'
        AND secret.revoked_at IS NULL
      RETURNING secret.id
    )
    UPDATE provider_connections
    SET status = 'action_required', updated_at = now()
    WHERE user_id = ${userId}
      AND provider = ${provider}::provider_kind
      AND credential_source = 'user_byok'
      AND EXISTS (SELECT 1 FROM revoked)
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}
