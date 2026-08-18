-- BYOK foundation for an existing Blue Jeans database.
-- Run once in the Neon SQL editor before enabling provider settings.

BEGIN;

DO $$ BEGIN
  CREATE TYPE wearer_access_role AS ENUM ('owner', 'wearer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wearer_membership_status AS ENUM ('active', 'deleting');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_kind AS ENUM ('google_ai_studio', 'uploadthing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE credential_source AS ENUM ('platform_env', 'user_byok');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_connection_status AS ENUM (
    'active',
    'action_required',
    'disabled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wearer_memberships (
  user_id text PRIMARY KEY,
  access_role wearer_access_role NOT NULL DEFAULT 'wearer',
  credential_source credential_source NOT NULL DEFAULT 'user_byok',
  status wearer_membership_status NOT NULL DEFAULT 'active',
  invited_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, credential_source),
  CHECK (
    (access_role = 'owner' AND credential_source = 'platform_env')
    OR
    (access_role = 'wearer' AND credential_source = 'user_byok')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS wearer_memberships_single_owner_uidx
  ON wearer_memberships (access_role)
  WHERE access_role = 'owner' AND status = 'active';

CREATE TABLE IF NOT EXISTS provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider provider_kind NOT NULL,
  credential_source credential_source NOT NULL,
  status provider_connection_status NOT NULL DEFAULT 'active',
  external_account_id text,
  is_default boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, credential_source)
    REFERENCES wearer_memberships (user_id, credential_source) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS provider_connections_user_id_idx
  ON provider_connections (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_user_default_uidx
  ON provider_connections (user_id, provider)
  WHERE is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_uploadthing_app_uidx
  ON provider_connections (external_account_id)
  WHERE provider = 'uploadthing' AND external_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL
    REFERENCES provider_connections (id) ON DELETE CASCADE,
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
  secret_hint text,
  tested_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_credentials_active_connection_uidx
  ON provider_credentials (connection_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE wearer_memberships IS
  'Invite-gated product admission and provider funding policy.';
COMMENT ON TABLE provider_connections IS
  'Logical provider account/app; media provenance will reference UploadThing connections.';
COMMENT ON TABLE provider_credentials IS
  'Write-only encrypted BYOK credentials; master keys stay outside Neon.';

COMMIT;
