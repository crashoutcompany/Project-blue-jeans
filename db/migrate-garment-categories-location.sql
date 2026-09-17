-- Existing Neon DBs: closet kinds + home-base location.
-- Fresh installs: run db/schema.sql instead (already includes these objects).
--
-- Safe to re-run. Creates garment_category when this database never got
-- schema.sql's enum (ALTER TYPE alone errors with 42704).

DO $$ BEGIN
  CREATE TYPE garment_category AS ENUM (
    'tops',
    'bottoms',
    'shoes',
    'outerwear',
    'accessories'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE garment_category ADD VALUE IF NOT EXISTS 'outerwear';
ALTER TYPE garment_category ADD VALUE IF NOT EXISTS 'accessories';

-- Closets that stored category as text still need the enum on garments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'garments'
      AND column_name = 'category'
      AND udt_name IS DISTINCT FROM 'garment_category'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM garments
      WHERE category IS NULL
         OR lower(category::text) NOT IN (
           'tops',
           'bottoms',
           'shoes',
           'outerwear',
           'accessories'
         )
    ) THEN
      RAISE EXCEPTION
        'garments.category has NULL or unsupported values; map them before converting to garment_category';
    END IF;

    ALTER TABLE garments
      ALTER COLUMN category TYPE garment_category
      USING (
        CASE lower(category::text)
          WHEN 'tops' THEN 'tops'::garment_category
          WHEN 'bottoms' THEN 'bottoms'::garment_category
          WHEN 'shoes' THEN 'shoes'::garment_category
          WHEN 'outerwear' THEN 'outerwear'::garment_category
          WHEN 'accessories' THEN 'accessories'::garment_category
        END
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wearer_preferences (
  user_id text PRIMARY KEY,
  location text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wearer_preferences IS 'Per-account home-base city for weather-aware planning. Empty falls back to New York, NY.';
COMMENT ON TYPE garment_category IS 'tops | bottoms | shoes | outerwear | accessories';
