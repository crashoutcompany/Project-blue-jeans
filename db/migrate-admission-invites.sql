-- Owner invitations for admitted Wearers.
-- Run once in the Neon SQL editor after db/migrate-byok-foundation.sql.

BEGIN;

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

COMMENT ON TABLE wearer_invitations IS
  'Owner-issued, one-time expiring email invites that bind an authenticated Wearer id.';

COMMIT;
