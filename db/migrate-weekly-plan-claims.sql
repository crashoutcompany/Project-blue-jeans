-- Existing Neon DBs: lease table that stops concurrent "Plan my week" runs.
-- Run once BEFORE deploying the app version that claims a week before
-- calling Gemini (without it, Plan my week fails with a database error).
-- Fresh installs: db/schema.sql already creates this table.

CREATE TABLE IF NOT EXISTS weekly_plan_claims (
  user_id text NOT NULL,
  week_start date NOT NULL,
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, week_start)
);
