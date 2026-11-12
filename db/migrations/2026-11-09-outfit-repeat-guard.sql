-- Outfit repeat guard (#61). Applied by `pnpm db:migrate`, which runs this file
-- in a transaction; to apply it by hand use `psql --single-transaction -f`.
-- db/schema.sql already has these columns for fresh databases.
--
-- What changes:
-- * outfit_wears.worn_confirmed_at: set by the "Wore this" tap. Committing an
--   Outfit to a day (Wear this, Change look, Wear today) no longer counts as
--   wearing it.
-- * outfits.worn_on becomes nullable: last worn now means the latest
--   confirmed wear, and an Outfit nobody has worn yet has none.
-- * wearer_preferences.repeat_window_days: days before Plan my week may
--   suggest a worn Outfit again (default 7, 0 turns the guard off).
--
-- Backfill: before this change every committed day counted as worn, so past
-- days (before today in America/New_York) are marked confirmed. Today and
-- future days stay unconfirmed. The column add and backfill run together, and
-- only once, so re-running this file is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'outfit_wears'
      AND column_name = 'worn_confirmed_at'
  ) THEN
    ALTER TABLE outfit_wears ADD COLUMN worn_confirmed_at timestamptz;

    UPDATE outfit_wears
    SET worn_confirmed_at = created_at
    WHERE worn_on < (now() AT TIME ZONE 'America/New_York')::date;

    ALTER TABLE outfits ALTER COLUMN worn_on DROP NOT NULL;

    UPDATE outfits o
    SET worn_on = (
      SELECT max(w.worn_on)
      FROM outfit_wears w
      WHERE w.outfit_id = o.id
        AND w.worn_confirmed_at IS NOT NULL
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS outfit_wears_user_confirmed_idx
  ON outfit_wears (user_id, worn_on DESC)
  WHERE worn_confirmed_at IS NOT NULL;

ALTER TABLE wearer_preferences
  ADD COLUMN IF NOT EXISTS repeat_window_days integer NOT NULL DEFAULT 7;

DO $$
BEGIN
  ALTER TABLE wearer_preferences
    ADD CONSTRAINT wearer_preferences_repeat_window_days_check
    CHECK (repeat_window_days BETWEEN 0 AND 30);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
