-- UploadThing BYOK media provenance for an existing Blue Jeans database.
-- Run once in the Neon SQL editor after db/migrate-byok-foundation.sql.

BEGIN;

DO $$ BEGIN
  CREATE TYPE media_kind AS ENUM ('closet_image', 'wearer_photo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  connection_id uuid REFERENCES provider_connections (id) ON DELETE SET NULL,
  kind media_kind NOT NULL,
  provider_file_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_file_key)
);

CREATE INDEX IF NOT EXISTS media_assets_user_id_idx ON media_assets (user_id);
CREATE INDEX IF NOT EXISTS media_assets_connection_id_idx
  ON media_assets (connection_id);

CREATE TABLE IF NOT EXISTS upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  connection_id uuid REFERENCES provider_connections (id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  media_asset_id uuid REFERENCES media_assets (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_intents_user_id_idx ON upload_intents (user_id);
CREATE INDEX IF NOT EXISTS upload_intents_expires_at_idx ON upload_intents (expires_at);

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS media_asset_id uuid
    REFERENCES media_assets (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS garments_media_asset_id_idx ON garments (media_asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS garments_user_media_asset_uidx
  ON garments (user_id, media_asset_id)
  WHERE media_asset_id IS NOT NULL;

ALTER TABLE wearer_profile
  ADD COLUMN IF NOT EXISTS media_asset_id uuid
    REFERENCES media_assets (id) ON DELETE SET NULL;

COMMENT ON TABLE media_assets IS
  'Owned UploadThing file identity. Browser reads go through /api/media/{id}.';
COMMENT ON TABLE upload_intents IS
  'Server-issued upload slots consumed by onUploadComplete; client mutations use media ids.';

COMMIT;
