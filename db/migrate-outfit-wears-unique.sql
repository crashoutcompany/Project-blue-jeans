-- Align outfit_wears day uniqueness with schema.sql / app upserts.
-- migrate-per-account.sql created a PARTIAL unique index
--   (user_id, worn_on) WHERE user_id IS NOT NULL
-- which does not satisfy `ON CONFLICT (user_id, worn_on)` without the same
-- predicate. Prefer a full UNIQUE constraint once user_id is populated.

-- Drop legacy global uniqueness if still present.
ALTER TABLE outfit_wears DROP CONSTRAINT IF EXISTS outfit_wears_worn_on_key;
DROP INDEX IF EXISTS outfit_wears_worn_on_key;
DROP INDEX IF EXISTS outfit_wears_user_worn_on_uidx;

-- Deduplicate any (user_id, worn_on) collisions before enforcing uniqueness.
DELETE FROM outfit_wears w
USING outfit_wears newer
WHERE w.user_id IS NOT NULL
  AND newer.user_id = w.user_id
  AND newer.worn_on = w.worn_on
  AND newer.ctid > w.ctid;

ALTER TABLE outfit_wears
  ADD CONSTRAINT outfit_wears_user_worn_on_key UNIQUE (user_id, worn_on);
