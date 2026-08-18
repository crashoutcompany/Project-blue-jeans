import "server-only";

import { requireSql } from "@/lib/db";
import { decodeUploadThingAppId } from "@/lib/credentials/validate-uploadthing";

/**
 * Owner files belong to the platform UploadThing app. Persist a connection
 * row when the membership exists so media_assets can record provenance.
 * Bootstrap owners without a membership row get a null connection id.
 */
export async function ensurePlatformUploadThingConnection(input: {
  userId: string;
  token: string;
}): Promise<string | null> {
  const appId = decodeUploadThingAppId(input.token);
  const sql = requireSql();
  const rows = (await sql`
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
      'uploadthing'::provider_kind,
      credential_source,
      'active'::provider_connection_status,
      ${appId},
      true,
      now()
    FROM wearer_memberships
    WHERE user_id = ${input.userId}
      AND credential_source = 'platform_env'
      AND status = 'active'
    ON CONFLICT (user_id, provider) WHERE is_default = true
    DO UPDATE SET
      status = 'active',
      external_account_id = COALESCE(
        EXCLUDED.external_account_id,
        provider_connections.external_account_id
      ),
      last_validated_at = now(),
      updated_at = now()
    RETURNING id
  `) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}
