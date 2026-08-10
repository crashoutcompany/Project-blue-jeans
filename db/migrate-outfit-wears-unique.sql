-- Align outfit_wears day uniqueness with schema.sql / app upserts.
-- migrate-per-account.sql created a PARTIAL unique index
--   (user_id, worn_on) WHERE user_id IS NOT NULL
-- which does not satisfy `ON CONFLICT (user_id, worn_on)` without the same
-- predicate. Prefer a full UNIQUE constraint once user_id is NOT NULL.

-- Drop legacy global uniqueness if still present.
ALTER TABLE outfit_wears DROP CONSTRAINT IF EXISTS outfit_wears_worn_on_key;
DROP INDEX IF EXISTS outfit_wears_worn_on_key;
DROP INDEX IF EXISTS outfit_wears_user_worn_on_uidx;

-- Backfill wear ownership from the parent outfit when possible.
UPDATE outfit_wears w
SET user_id = o.user_id
FROM outfits o
WHERE w.outfit_id = o.id
  AND w.user_id IS NULL
  AND o.user_id IS NOT NULL;

-- Optional legacy claim (same pattern as migrate-per-account.sql):
--   SELECT set_config('app.claim_user_id', '<your-neon-auth-user-id>', false);
UPDATE outfit_wears
SET user_id = nullif(current_setting('app.claim_user_id', true), '')
WHERE user_id IS NULL
  AND nullif(current_setting('app.claim_user_id', true), '') IS NOT NULL;

-- Refuse to proceed with unowned wears (UNIQUE + NOT NULL would be unsafe / invalid).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM outfit_wears WHERE user_id IS NULL) THEN
    RAISE EXCEPTION
      'outfit_wears still has NULL user_id; assign ownership (UPDATE … SET user_id = …) or set_config(''app.claim_user_id'', …) then re-run';
  END IF;
END $$;

ALTER TABLE outfit_wears
  ALTER COLUMN user_id SET NOT NULL;

-- Deduplicate (user_id, worn_on) collisions before enforcing uniqueness.
-- Retention: keep the latest wear by created_at; break ties with larger id
-- (deterministic, stable business ordering — not ctid).
DELETE FROM outfit_wears w
USING outfit_wears newer
WHERE newer.user_id = w.user_id
  AND newer.worn_on = w.worn_on
  AND newer.id <> w.id
  AND (
    newer.created_at > w.created_at
    OR (newer.created_at = w.created_at AND newer.id::text > w.id::text)
  );

ALTER TABLE outfit_wears
  ADD CONSTRAINT outfit_wears_user_worn_on_key UNIQUE (user_id, worn_on);
