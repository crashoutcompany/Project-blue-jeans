-- Existing Neon DBs: generated outfit hero images become owned media assets.
-- Run once BEFORE deploying the app version that stores heroes as
-- `/api/media/<id>` paths instead of base64 data URLs.
-- Fresh installs: db/schema.sql already includes this value.

ALTER TYPE media_kind ADD VALUE IF NOT EXISTS 'outfit_hero';
