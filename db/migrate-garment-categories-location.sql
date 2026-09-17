-- Existing Neon DBs: closet kinds + home-base location.
-- Fresh installs: db/schema.sql already includes these objects.

ALTER TYPE garment_category ADD VALUE IF NOT EXISTS 'outerwear';
ALTER TYPE garment_category ADD VALUE IF NOT EXISTS 'accessories';

CREATE TABLE IF NOT EXISTS wearer_preferences (
  user_id text PRIMARY KEY,
  location text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wearer_preferences IS 'Per-account home-base city for weather-aware planning. Empty falls back to New York, NY.';
COMMENT ON TYPE garment_category IS 'tops | bottoms | shoes | outerwear | accessories';
