-- BYOK hardening for an existing Blue Jeans database.
-- Run once in the Neon SQL editor after db/migrate-admission-invites.sql.

BEGIN;

-- Disconnect now deletes ciphertext. Purge rows revoked before that change so
-- a disconnected key is no longer decryptable from a database copy.
DELETE FROM provider_credentials WHERE revoked_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS provider_validation_attempts (
  user_id text NOT NULL
    REFERENCES wearer_memberships (user_id) ON DELETE CASCADE,
  provider provider_kind NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, provider)
);

COMMENT ON TABLE provider_validation_attempts IS
  'Fixed-window count of BYOK key validations per Wearer, so Settings cannot be used as a key oracle.';

COMMIT;
