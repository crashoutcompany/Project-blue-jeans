-- Per Wearer account isolation.
-- Run once in Neon SQL editor AFTER migrate-outfit-wears + migrate-wearer-profile.
--
-- Claim existing shared rows (optional) before or after adding columns:
--   UPDATE garments SET user_id = '<your-neon-auth-user-id>' WHERE user_id IS NULL;
--   …same for outfits / weekly_outfit_plans / outfit_wears.
--
-- To attach the legacy singleton wearer photo to an account, run first:
--   SELECT set_config('app.claim_user_id', '<your-neon-auth-user-id>', false);

ALTER TABLE garments ADD COLUMN IF NOT EXISTS user_id text;
CREATE INDEX IF NOT EXISTS garments_user_id_idx ON garments (user_id);

ALTER TABLE outfits ADD COLUMN IF NOT EXISTS user_id text;
CREATE INDEX IF NOT EXISTS outfits_user_id_idx ON outfits (user_id);

ALTER TABLE outfit_wears ADD COLUMN IF NOT EXISTS user_id text;
CREATE INDEX IF NOT EXISTS outfit_wears_user_id_idx ON outfit_wears (user_id);

ALTER TABLE weekly_outfit_plans ADD COLUMN IF NOT EXISTS user_id text;
CREATE INDEX IF NOT EXISTS weekly_outfit_plans_user_id_idx ON weekly_outfit_plans (user_id);

-- Backfill wear user_id from parent outfit when possible.
UPDATE outfit_wears w
SET user_id = o.user_id
FROM outfits o
WHERE w.outfit_id = o.id
  AND w.user_id IS NULL
  AND o.user_id IS NOT NULL;

-- Deduplicate before per-user unique indexes (keep newest outfit / wear).
DO $$
DECLARE
  r record;
  keep_id uuid;
  drop_id uuid;
BEGIN
  FOR r IN
    SELECT user_id, garment_set_key AS key
    FROM outfits
    WHERE user_id IS NOT NULL
      AND garment_set_key IS NOT NULL
      AND garment_set_key <> ''
    GROUP BY user_id, garment_set_key
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM outfits
    WHERE user_id = r.user_id AND garment_set_key = r.key
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    FOR drop_id IN
      SELECT id FROM outfits
      WHERE user_id = r.user_id AND garment_set_key = r.key AND id <> keep_id
    LOOP
      UPDATE outfit_wears SET outfit_id = keep_id WHERE outfit_id = drop_id;
      DELETE FROM outfits WHERE id = drop_id;
    END LOOP;
  END LOOP;

  -- One wear per (user_id, worn_on): keep newest created_at.
  DELETE FROM outfit_wears w
  USING outfit_wears newer
  WHERE w.user_id IS NOT NULL
    AND newer.user_id = w.user_id
    AND newer.worn_on = w.worn_on
    AND newer.id <> w.id
    AND (
      newer.created_at > w.created_at
      OR (newer.created_at = w.created_at AND newer.id::text > w.id::text)
    );
END $$;

-- Replace global uniqueness with per-user uniqueness.
DROP INDEX IF EXISTS outfits_garment_set_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS outfits_user_garment_set_key_uidx
  ON outfits (user_id, garment_set_key)
  WHERE user_id IS NOT NULL
    AND garment_set_key IS NOT NULL
    AND garment_set_key <> '';

ALTER TABLE outfit_wears DROP CONSTRAINT IF EXISTS outfit_wears_worn_on_key;
DROP INDEX IF EXISTS outfit_wears_worn_on_key;
CREATE UNIQUE INDEX IF NOT EXISTS outfit_wears_user_worn_on_uidx
  ON outfit_wears (user_id, worn_on)
  WHERE user_id IS NOT NULL;

ALTER TABLE weekly_outfit_plans DROP CONSTRAINT IF EXISTS weekly_outfit_plans_week_start_key;
DROP INDEX IF EXISTS weekly_outfit_plans_week_start_key;
CREATE UNIQUE INDEX IF NOT EXISTS weekly_outfit_plans_user_week_uidx
  ON weekly_outfit_plans (user_id, week_start)
  WHERE user_id IS NOT NULL;

-- Wearer photo: move from singleton id=1 to per-user rows (only with explicit claim).
CREATE TABLE IF NOT EXISTS wearer_profile_v2 (
  user_id text PRIMARY KEY,
  image_url text NOT NULL,
  uploadthing_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  claim_id text := nullif(current_setting('app.claim_user_id', true), '');
  legacy_count int := 0;
  copied int := 0;
  has_legacy_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wearer_profile'
      AND column_name = 'id'
  ) INTO has_legacy_id;

  IF NOT has_legacy_id THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'wearer_profile_v2'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'wearer_profile'
    ) THEN
      ALTER TABLE wearer_profile_v2 RENAME TO wearer_profile;
    ELSE
      DROP TABLE IF EXISTS wearer_profile_v2;
    END IF;
    RETURN;
  END IF;

  SELECT count(*)::int INTO legacy_count FROM wearer_profile;

  IF claim_id IS NOT NULL AND legacy_count > 0 THEN
    INSERT INTO wearer_profile_v2 (user_id, image_url, uploadthing_key, updated_at)
    SELECT claim_id, w.image_url, w.uploadthing_key, w.updated_at
    FROM wearer_profile w
    ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS copied = ROW_COUNT;
  END IF;

  IF legacy_count = 0 OR copied > 0 THEN
    DROP TABLE wearer_profile;
    ALTER TABLE wearer_profile_v2 RENAME TO wearer_profile;
  ELSE
    -- Keep legacy singleton photo; do not destroy it without an explicit claim.
    RAISE NOTICE
      'wearer_profile cutover skipped: set app.claim_user_id to your Neon Auth user id, then re-run this migration section';
    DROP TABLE IF EXISTS wearer_profile_v2;
  END IF;
END $$;

COMMENT ON COLUMN garments.user_id IS 'Neon Auth Wearer account id';
COMMENT ON COLUMN outfits.user_id IS 'Neon Auth Wearer account id';
COMMENT ON COLUMN outfit_wears.user_id IS 'Neon Auth Wearer account id (denormalized for day uniqueness)';
COMMENT ON COLUMN weekly_outfit_plans.user_id IS 'Neon Auth Wearer account id';
