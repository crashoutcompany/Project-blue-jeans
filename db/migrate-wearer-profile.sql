-- Existing Neon DBs: Wearer photo for try-on heroes (legacy singleton).
-- Run once after migrate-outfit-wears.sql, before migrate-per-account.sql.
-- Fresh installs: db/schema.sql already has per-user wearer_profile (user_id PK).
--
-- migrate-per-account.sql converts this singleton into per-account rows.
-- Claim the legacy photo by setting the Neon Auth user id before that migration:
--   SELECT set_config('app.claim_user_id', '<your-neon-auth-user-id>', false);

CREATE TABLE IF NOT EXISTS wearer_profile (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_url text NOT NULL,
  uploadthing_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wearer_profile IS 'Legacy singleton body/reference photo; migrate-per-account moves to per-user rows.';
