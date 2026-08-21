-- Neon / Postgres — fresh install: run in Neon SQL Editor or via migration tool.
-- UploadThing: store public `image_url` (CDN); `uploadthing_key` for delete/rename via API.

-- Enum: category for each garment (tops / bottoms / shoes).
DO $$ BEGIN
  CREATE TYPE garment_category AS ENUM ('tops', 'bottoms', 'shoes');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum: where / how formal the outfit was (aligns with closet filter language).
DO $$ BEGIN
  CREATE TYPE outfit_occasion AS ENUM (
    'everyday',
    'casual',
    'business',
    'evening',
    'office',
    'gala'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE weekly_plan_status AS ENUM (
    'draft',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

DO $$ BEGIN
  CREATE TYPE media_kind AS ENUM ('closet_image', 'wearer_photo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admission, authorization, and provider funding are separate account policies.
CREATE TABLE IF NOT EXISTS wearer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by_user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_user_id text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wearer_invitations_open_email_uidx
  ON wearer_invitations (email_normalized)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- Expired unused rows are deleted in createWearerInvite; now() cannot appear
-- in a unique index predicate.
CREATE INDEX IF NOT EXISTS wearer_invitations_invited_by_idx
  ON wearer_invitations (invited_by_user_id);

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

-- A connection identifies the provider account/app. Secrets are versioned separately.
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

-- Ciphertext is AES-256-GCM. The versioned master key never lives in Postgres.
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

-- Private UploadThing objects. Display uses /api/media/{id}, never a durable public CDN URL.
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

CREATE TABLE IF NOT EXISTS garments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  uploadthing_key text,
  media_asset_id uuid REFERENCES media_assets (id) ON DELETE SET NULL,
  category garment_category NOT NULL,
  color text,
  is_favorite boolean NOT NULL DEFAULT false,
  name text,
  notes text,
  description text NOT NULL DEFAULT '',
  -- Neon Auth Wearer account id (text).
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garments_created_at_idx ON garments (created_at DESC);
CREATE INDEX IF NOT EXISTS garments_category_idx ON garments (category);
CREATE INDEX IF NOT EXISTS garments_color_idx ON garments (color);
CREATE INDEX IF NOT EXISTS garments_is_favorite_idx ON garments (is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS garments_user_id_idx ON garments (user_id);
CREATE INDEX IF NOT EXISTS garments_media_asset_id_idx ON garments (media_asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS garments_user_media_asset_uidx
  ON garments (user_id, media_asset_id)
  WHERE media_asset_id IS NOT NULL;

-- Wearer photo per account for try-on heroes.
CREATE TABLE IF NOT EXISTS wearer_profile (
  user_id text PRIMARY KEY,
  image_url text NOT NULL,
  uploadthing_key text,
  media_asset_id uuid REFERENCES media_assets (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wearer_profile IS 'Per-account body/reference photo for try-on hero composites.';

-- Outfit: unique garment-set recipe (Closet → Outfits). Days live in outfit_wears.
CREATE TABLE IF NOT EXISTS outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text,
  -- Denormalized last-worn date (max of outfit_wears.worn_on).
  worn_on date NOT NULL,
  occasion outfit_occasion NOT NULL DEFAULT 'casual',
  name text,
  -- Sorted unique garment UUID string; same clothes = same Outfit (per user).
  garment_set_key text,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outfits_worn_on_idx ON outfits (worn_on DESC);
CREATE INDEX IF NOT EXISTS outfits_occasion_idx ON outfits (occasion);
CREATE INDEX IF NOT EXISTS outfits_user_id_idx ON outfits (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS outfits_user_garment_set_key_uidx
  ON outfits (user_id, garment_set_key)
  WHERE garment_set_key IS NOT NULL AND garment_set_key <> '';

-- Each row = one garment used in that outfit (many garments per outfit).
CREATE TABLE IF NOT EXISTS outfit_garments (
  outfit_id uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
  garment_id uuid NOT NULL REFERENCES garments (id) ON DELETE RESTRICT,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (outfit_id, garment_id)
);

CREATE INDEX IF NOT EXISTS outfit_garments_garment_idx ON outfit_garments (garment_id);
CREATE INDEX IF NOT EXISTS outfit_garments_outfit_sort_idx ON outfit_garments (outfit_id, sort_order);

-- Day a Wearer committed an Outfit (one Outfit identity, many wear dates).
-- Composite FK keeps wear.user_id aligned with the parent outfit owner.
CREATE UNIQUE INDEX IF NOT EXISTS outfits_id_user_uidx ON outfits (id, user_id);

CREATE TABLE IF NOT EXISTS outfit_wears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL,
  user_id text NOT NULL,
  worn_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, worn_on),
  FOREIGN KEY (outfit_id, user_id) REFERENCES outfits (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS outfit_wears_outfit_idx ON outfit_wears (outfit_id);
CREATE INDEX IF NOT EXISTS outfit_wears_worn_on_idx ON outfit_wears (worn_on DESC);
CREATE INDEX IF NOT EXISTS outfit_wears_user_id_idx ON outfit_wears (user_id);

-- Weekly AI plan: step 1 (structured looks) + inline hero images per day.
CREATE TABLE IF NOT EXISTS weekly_outfit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  step1_raw jsonb,
  status weekly_plan_status NOT NULL DEFAULT 'draft',
  error_message text,
  user_id text NOT NULL,
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_outfit_plans_week_start_idx ON weekly_outfit_plans (week_start DESC);
CREATE INDEX IF NOT EXISTS weekly_outfit_plans_user_id_idx ON weekly_outfit_plans (user_id);

CREATE TABLE IF NOT EXISTS weekly_plan_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES weekly_outfit_plans (id) ON DELETE CASCADE,
  sort_order int NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  garment_ids uuid[] NOT NULL DEFAULT '{}',
  hero_image_url text,
  UNIQUE (plan_id, sort_order)
);

CREATE INDEX IF NOT EXISTS weekly_plan_looks_plan_sort_idx ON weekly_plan_looks (plan_id, sort_order);

COMMENT ON TYPE garment_category IS 'tops | bottoms | shoes';
COMMENT ON TYPE outfit_occasion IS 'everyday | casual | business | evening | office | gala';
COMMENT ON TYPE weekly_plan_status IS 'draft | completed | failed';
COMMENT ON TYPE provider_kind IS 'External services that may use platform env credentials or per-Wearer BYOK.';
COMMENT ON TYPE credential_source IS 'platform_env for the sole owner; user_byok for admitted Wearers.';
COMMENT ON TABLE wearer_invitations IS 'Owner-issued, one-time expiring email invites that bind an authenticated Wearer id.';
COMMENT ON TABLE wearer_memberships IS 'Invite-gated product admission and provider funding policy.';
COMMENT ON TABLE provider_connections IS 'Logical provider account/app; media_assets.connection_id is UploadThing provenance.';
COMMENT ON TABLE provider_credentials IS 'Write-only encrypted BYOK credentials; master keys stay outside Neon.';
COMMENT ON TABLE media_assets IS 'Owned UploadThing file identity. Browser reads go through /api/media/{id}.';
COMMENT ON TABLE upload_intents IS 'Server-issued upload slots consumed by onUploadComplete; client mutations use media ids.';
COMMENT ON COLUMN garments.color IS 'Free text: e.g. hex #1a1c1b or name "navy".';
COMMENT ON COLUMN garments.description IS 'Stylist-facing text for AI outfit selection (closet catalog).';
COMMENT ON TABLE garments IS 'Clothing pieces; category enum; is_favorite for closet highlights.';
COMMENT ON TABLE outfits IS 'Unique garment-set look in Closet → Outfits; worn_on is last worn; days in outfit_wears.';
COMMENT ON COLUMN outfits.garment_set_key IS 'Sorted unique garment UUIDs; Closet Outfits uniqueness key.';
COMMENT ON COLUMN outfits.worn_on IS 'Denormalized last-worn date (max outfit_wears.worn_on).';
COMMENT ON TABLE outfit_garments IS 'Links outfits to every garment in the look (required usage: insert one row per piece).';
COMMENT ON TABLE outfit_wears IS 'Day assignment of a shared Outfit (one wear per calendar day).';
COMMENT ON TABLE weekly_outfit_plans IS 'One row per calendar week (week_start = Sunday); AI weekly outfit pipeline. Monday cron deletes plans older than the current week.';
COMMENT ON TABLE weekly_plan_looks IS 'Seven rows per plan (sort_order 0–6 = Mon–Sun); garment_ids from step 1; hero_image_url from inline image step.';
