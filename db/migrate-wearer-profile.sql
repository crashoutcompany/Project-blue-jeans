-- Existing Neon DBs: Wearer photo for try-on heroes.
-- Run once in the Neon SQL editor. Fresh installs: db/schema.sql already includes this.

CREATE TABLE IF NOT EXISTS wearer_profile (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_url text NOT NULL,
  uploadthing_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wearer_profile IS 'Single saved body/reference photo for try-on hero composites.';
