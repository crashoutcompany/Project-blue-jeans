-- Migrate existing Neon DBs: Outfit identity + many wear dates.
-- Run once in the Neon SQL editor after pulling this change.
-- Fresh installs: prefer db/schema.sql (already includes these objects).
--
-- REQUIRED ORDER: run this file, then migrate-wearer-profile.sql, then
-- migrate-per-account.sql. Until per-account runs, UNIQUE(worn_on) and
-- outfits_garment_set_key_uidx are GLOBAL (pre-user_id). migrate-per-account
-- replaces them with per-user uniqueness and scopes garment-set dedupe.

CREATE TABLE IF NOT EXISTS outfit_wears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
  worn_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Temporary global day uniqueness; migrate-per-account → (user_id, worn_on).
  UNIQUE (worn_on)
);

CREATE INDEX IF NOT EXISTS outfit_wears_outfit_idx ON outfit_wears (outfit_id);
CREATE INDEX IF NOT EXISTS outfit_wears_worn_on_idx ON outfit_wears (worn_on DESC);

ALTER TABLE outfits ADD COLUMN IF NOT EXISTS garment_set_key text;

-- One wear row per existing outfit day (skip days already migrated).
INSERT INTO outfit_wears (outfit_id, worn_on)
SELECT o.id, o.worn_on
FROM outfits o
WHERE NOT EXISTS (
  SELECT 1 FROM outfit_wears w WHERE w.worn_on = o.worn_on
)
ON CONFLICT (worn_on) DO NOTHING;

-- Backfill garment_set_key from linked garments.
UPDATE outfits o
SET garment_set_key = sub.key
FROM (
  SELECT
    og.outfit_id,
    string_agg(og.garment_id::text, ',' ORDER BY og.garment_id::text) AS key
  FROM outfit_garments og
  GROUP BY og.outfit_id
) AS sub
WHERE o.id = sub.outfit_id
  AND (o.garment_set_key IS NULL OR o.garment_set_key = '');

-- Merge duplicate garment sets (global; pre-user_id): keep newest, move wears, drop extras.
-- After migrate-per-account, uniqueness is (user_id, garment_set_key).
DO $$
DECLARE
  r record;
  keep_id uuid;
  drop_id uuid;
BEGIN
  FOR r IN
    SELECT garment_set_key AS key
    FROM outfits
    WHERE garment_set_key IS NOT NULL AND garment_set_key <> ''
    GROUP BY garment_set_key
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM outfits
    WHERE garment_set_key = r.key
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    FOR drop_id IN
      SELECT id FROM outfits
      WHERE garment_set_key = r.key AND id <> keep_id
    LOOP
      UPDATE outfit_wears SET outfit_id = keep_id WHERE outfit_id = drop_id;
      DELETE FROM outfits WHERE id = drop_id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS outfits_garment_set_key_uidx
  ON outfits (garment_set_key)
  WHERE garment_set_key IS NOT NULL AND garment_set_key <> '';

COMMENT ON TABLE outfit_wears IS 'Day assignment of a shared Outfit (garment-set identity).';
COMMENT ON COLUMN outfits.garment_set_key IS 'Sorted unique garment UUIDs; Closet Outfits uniqueness key.';
COMMENT ON COLUMN outfits.worn_on IS 'Denormalized last-worn date (max outfit_wears.worn_on).';
