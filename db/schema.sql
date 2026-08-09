-- Neon / Postgres — fresh install: run in Neon SQL Editor or via migration tool.
-- UploadThing: store public `image_url` (CDN); `uploadthing_key` for delete/rename via API.

-- Enum: category for each garment (tops / bottoms / shoes).
DO $$ BEGIN
  CREATE TYPE garment_category AS ENUM ('tops', 'bottoms', 'shoes');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum: where / how formal the outfit was (aligns with closet filter language).
DO $$ BEGIN
  CREATE TYPE outfit_occasion AS ENUM (
    'everyday',
    'casual',
    'business',
    'evening',
    'office',
    'gala'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE weekly_plan_status AS ENUM (
    'draft',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS garments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  uploadthing_key text,
  category garment_category NOT NULL,
  color text,
  is_favorite boolean NOT NULL DEFAULT false,
  name text,
  notes text,
  description text NOT NULL DEFAULT '',
  -- Neon Auth Wearer account id (text).
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garments_created_at_idx ON garments (created_at DESC);
CREATE INDEX IF NOT EXISTS garments_category_idx ON garments (category);
CREATE INDEX IF NOT EXISTS garments_color_idx ON garments (color);
CREATE INDEX IF NOT EXISTS garments_is_favorite_idx ON garments (is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS garments_user_id_idx ON garments (user_id);

-- Wearer photo per account for try-on heroes.
CREATE TABLE IF NOT EXISTS wearer_profile (
  user_id text PRIMARY KEY,
  image_url text NOT NULL,
  uploadthing_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wearer_profile IS 'Per-account body/reference photo for try-on hero composites.';

-- Outfit: unique garment-set recipe (Closet → Outfits). Days live in outfit_wears.
CREATE TABLE IF NOT EXISTS outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text,
  -- Denormalized last-worn date (max of outfit_wears.worn_on).
  worn_on date NOT NULL,
  occasion outfit_occasion NOT NULL DEFAULT 'casual',
  name text,
  -- Sorted unique garment UUID string; same clothes = same Outfit (per user).
  garment_set_key text,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outfits_worn_on_idx ON outfits (worn_on DESC);
CREATE INDEX IF NOT EXISTS outfits_occasion_idx ON outfits (occasion);
CREATE INDEX IF NOT EXISTS outfits_user_id_idx ON outfits (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS outfits_user_garment_set_key_uidx
  ON outfits (user_id, garment_set_key)
  WHERE garment_set_key IS NOT NULL AND garment_set_key <> '';

-- Each row = one garment used in that outfit (many garments per outfit).
CREATE TABLE IF NOT EXISTS outfit_garments (
  outfit_id uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
  garment_id uuid NOT NULL REFERENCES garments (id) ON DELETE RESTRICT,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (outfit_id, garment_id)
);

CREATE INDEX IF NOT EXISTS outfit_garments_garment_idx ON outfit_garments (garment_id);
CREATE INDEX IF NOT EXISTS outfit_garments_outfit_sort_idx ON outfit_garments (outfit_id, sort_order);

-- Day a Wearer committed an Outfit (one Outfit identity, many wear dates).
CREATE TABLE IF NOT EXISTS outfit_wears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
  user_id text NOT NULL,
  worn_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, worn_on)
);

CREATE INDEX IF NOT EXISTS outfit_wears_outfit_idx ON outfit_wears (outfit_id);
CREATE INDEX IF NOT EXISTS outfit_wears_worn_on_idx ON outfit_wears (worn_on DESC);
CREATE INDEX IF NOT EXISTS outfit_wears_user_id_idx ON outfit_wears (user_id);

-- Weekly AI plan: step 1 (structured looks) + inline hero images per day.
CREATE TABLE IF NOT EXISTS weekly_outfit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  step1_raw jsonb,
  status weekly_plan_status NOT NULL DEFAULT 'draft',
  error_message text,
  user_id text NOT NULL,
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_outfit_plans_week_start_idx ON weekly_outfit_plans (week_start DESC);
CREATE INDEX IF NOT EXISTS weekly_outfit_plans_user_id_idx ON weekly_outfit_plans (user_id);

CREATE TABLE IF NOT EXISTS weekly_plan_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES weekly_outfit_plans (id) ON DELETE CASCADE,
  sort_order int NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  garment_ids uuid[] NOT NULL DEFAULT '{}',
  hero_image_url text,
  UNIQUE (plan_id, sort_order)
);

CREATE INDEX IF NOT EXISTS weekly_plan_looks_plan_sort_idx ON weekly_plan_looks (plan_id, sort_order);

COMMENT ON TYPE garment_category IS 'tops | bottoms | shoes';
COMMENT ON TYPE outfit_occasion IS 'everyday | casual | business | evening | office | gala';
COMMENT ON TYPE weekly_plan_status IS 'draft | completed | failed';
COMMENT ON COLUMN garments.color IS 'Free text: e.g. hex #1a1c1b or name "navy".';
COMMENT ON COLUMN garments.description IS 'Stylist-facing text for AI outfit selection (closet catalog).';
COMMENT ON TABLE garments IS 'Clothing pieces; category enum; is_favorite for closet highlights.';
COMMENT ON TABLE outfits IS 'Unique garment-set look in Closet → Outfits; worn_on is last worn; days in outfit_wears.';
COMMENT ON COLUMN outfits.garment_set_key IS 'Sorted unique garment UUIDs; Closet Outfits uniqueness key.';
COMMENT ON COLUMN outfits.worn_on IS 'Denormalized last-worn date (max outfit_wears.worn_on).';
COMMENT ON TABLE outfit_garments IS 'Links outfits to every garment in the look (required usage: insert one row per piece).';
COMMENT ON TABLE outfit_wears IS 'Day assignment of a shared Outfit (one wear per calendar day).';
COMMENT ON TABLE weekly_outfit_plans IS 'One row per calendar week (week_start = Monday); AI weekly outfit pipeline.';
COMMENT ON TABLE weekly_plan_looks IS 'Seven rows per plan (sort_order 0–6 = Mon–Sun); garment_ids from step 1; hero_image_url from inline image step.';
