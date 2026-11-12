-- Foreign keys from user-owned tables to "user" (BJ-8), so deleting a user
-- removes their data instead of orphaning it. db/schema.sql has them inline for
-- fresh databases; this adds them to existing ones.
--
-- Added NOT VALID: new writes are checked at once, but existing rows are not
-- scanned, so orphan rows from before this migration cannot make it fail. Find
-- orphans with the query below, remove them, then run
--   ALTER TABLE <table> VALIDATE CONSTRAINT <table>_user_id_fkey;
-- Tables reached through another cascade need no key of their own:
-- provider_connections and provider_validation_attempts (wearer_memberships),
-- outfit_garments and outfit_wears (outfits), weekly_plan_looks (plans).
--
-- Orphan check (every row returned is a user_id with no "user" row):
--   SELECT 'wearer_memberships' AS tbl, user_id FROM wearer_memberships t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'media_assets' AS tbl, user_id FROM media_assets t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'upload_intents' AS tbl, user_id FROM upload_intents t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'garments' AS tbl, user_id FROM garments t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'wearer_profile' AS tbl, user_id FROM wearer_profile t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'wearer_preferences' AS tbl, user_id FROM wearer_preferences t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'outfits' AS tbl, user_id FROM outfits t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'weekly_outfit_plans' AS tbl, user_id FROM weekly_outfit_plans t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   UNION ALL
--   SELECT 'weekly_plan_claims' AS tbl, user_id FROM weekly_plan_claims t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id)
--   ;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wearer_memberships',
    'media_assets',
    'upload_intents',
    'garments',
    'wearer_profile',
    'wearer_preferences',
    'outfits',
    'weekly_outfit_plans',
    'weekly_plan_claims'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = t || '_user_id_fkey'
        AND conrelid = to_regclass(format('%I', t))
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT VALID',
        t, t || '_user_id_fkey'
      );
    END IF;
  END LOOP;
END $$;
