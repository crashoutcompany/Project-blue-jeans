-- Per Wearer account isolation.
-- Run once in Neon SQL editor after migrate-outfit-wears + migrate-wearer-profile.
--
-- Claim existing shared rows (optional) by running first:
--   UPDATE garments SET user_id = '<your-neon-auth-user-id>' WHERE user_id IS NULL;
--   …same for outfits / weekly_outfit_plans after columns exist, or re-run the
--   UPDATE blocks below after setting app.owner via the DO block comment.

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

-- Replace global uniqueness with per-user uniqueness.
DROP INDEX IF EXISTS outfits_garment_set_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS outfits_user_garment_set_key_uidx
  ON outfits (user_id, garment_set_key)
  WHERE user_id IS NOT NULL
    AND garment_set_key IS NOT NULL
    AND garment_set_key <> '';

ALTER TABLE outfit_wears DROP CONSTRAINT IF EXISTS outfit_wears_worn_on_key;
-- Constraint name may vary; also try unique index drop:
DROP INDEX IF EXISTS outfit_wears_worn_on_key;
CREATE UNIQUE INDEX IF NOT EXISTS outfit_wears_user_worn_on_uidx
  ON outfit_wears (user_id, worn_on)
  WHERE user_id IS NOT NULL;

ALTER TABLE weekly_outfit_plans DROP CONSTRAINT IF EXISTS weekly_outfit_plans_week_start_key;
DROP INDEX IF EXISTS weekly_outfit_plans_week_start_key;
CREATE UNIQUE INDEX IF NOT EXISTS weekly_outfit_plans_user_week_uidx
  ON weekly_outfit_plans (user_id, week_start)
  WHERE user_id IS NOT NULL;

-- Wearer photo: move from singleton id=1 to per-user rows.
CREATE TABLE IF NOT EXISTS wearer_profile_v2 (
  user_id text PRIMARY KEY,
  image_url text NOT NULL,
  uploadthing_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wearer_profile_v2 (user_id, image_url, uploadthing_key, updated_at)
SELECT g.user_id, w.image_url, w.uploadthing_key, w.updated_at
FROM wearer_profile w
CROSS JOIN (
  SELECT DISTINCT user_id FROM garments WHERE user_id IS NOT NULL LIMIT 1
) g
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'wearer_profile' AND column_name = 'id'
)
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wearer_profile'
      AND column_name = 'id'
  ) THEN
    DROP TABLE wearer_profile;
    ALTER TABLE wearer_profile_v2 RENAME TO wearer_profile;
  ELSIF EXISTS (
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
END $$;

COMMENT ON COLUMN garments.user_id IS 'Neon Auth Wearer account id';
COMMENT ON COLUMN outfits.user_id IS 'Neon Auth Wearer account id';
COMMENT ON COLUMN outfit_wears.user_id IS 'Neon Auth Wearer account id (denormalized for day uniqueness)';
COMMENT ON COLUMN weekly_outfit_plans.user_id IS 'Neon Auth Wearer account id';
