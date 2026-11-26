-- Retire closet pieces (#88). Applied by `pnpm db:migrate`, which runs this file
-- in a transaction. db/schema.sql already has this column for fresh databases.
--
-- garments.retired_at: set when the Wearer retires (hides) a piece; NULL means
-- it is in the active Closet. Retiring is not deleting: the photo, the row, and
-- past Outfits stay. Retired pieces are left out of the active Closet, AI
-- planning, and shopping gaps, and can be unhidden from Closet → Retired.

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;
