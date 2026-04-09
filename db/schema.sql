-- Neon / Postgres — run in Neon SQL Editor or via migration tool.
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
    'batch_submitted',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional: multi-tenant / auth later (nullable until you wire Clerk etc.)
-- ALTER TABLE garments ADD CONSTRAINT garments_user_fk FOREIGN KEY (user_id) REFERENCES users (id);

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
  -- user_id uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garments_created_at_idx ON garments (created_at DESC);
CREATE INDEX IF NOT EXISTS garments_category_idx ON garments (category);
CREATE INDEX IF NOT EXISTS garments_color_idx ON garments (color);
CREATE INDEX IF NOT EXISTS garments_is_favorite_idx ON garments (is_favorite) WHERE is_favorite = true;

-- Outfit: hero `image_url`, calendar day, optional name.
CREATE TABLE IF NOT EXISTS outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text,
  worn_on date NOT NULL,
  occasion outfit_occasion NOT NULL DEFAULT 'casual',
  name text,
  -- user_id uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outfits_worn_on_idx ON outfits (worn_on DESC);
CREATE INDEX IF NOT EXISTS outfits_occasion_idx ON outfits (occasion);

-- Each row = one garment used in that outfit (many garments per outfit).
CREATE TABLE IF NOT EXISTS outfit_garments (
  outfit_id uuid NOT NULL REFERENCES outfits (id) ON DELETE CASCADE,
  garment_id uuid NOT NULL REFERENCES garments (id) ON DELETE RESTRICT,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (outfit_id, garment_id)
);

CREATE INDEX IF NOT EXISTS outfit_garments_garment_idx ON outfit_garments (garment_id);
CREATE INDEX IF NOT EXISTS outfit_garments_outfit_sort_idx ON outfit_garments (outfit_id, sort_order);

-- Weekly AI plan: step 1 (structured looks) + batch image generation lifecycle.
CREATE TABLE IF NOT EXISTS weekly_outfit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  step1_raw jsonb,
  status weekly_plan_status NOT NULL DEFAULT 'draft',
  error_message text,
  -- user_id uuid REFERENCES users (id),
  UNIQUE (week_start)
);

CREATE INDEX IF NOT EXISTS weekly_outfit_plans_week_start_idx ON weekly_outfit_plans (week_start DESC);

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

CREATE TABLE IF NOT EXISTS google_batch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES weekly_outfit_plans (id) ON DELETE CASCADE,
  google_batch_name text NOT NULL,
  state text NOT NULL DEFAULT 'JOB_STATE_PENDING',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS google_batch_jobs_plan_idx ON google_batch_jobs (plan_id);
CREATE INDEX IF NOT EXISTS google_batch_jobs_name_idx ON google_batch_jobs (google_batch_name);

COMMENT ON TYPE garment_category IS 'tops | bottoms | shoes';
COMMENT ON TYPE outfit_occasion IS 'everyday | casual | business | evening | office | gala';
COMMENT ON TYPE weekly_plan_status IS 'draft | batch_submitted | completed | failed';
COMMENT ON COLUMN garments.color IS 'Free text: e.g. hex #1a1c1b or name "navy".';
COMMENT ON COLUMN garments.description IS 'Stylist-facing text for AI outfit selection (closet catalog).';
COMMENT ON TABLE garments IS 'Clothing pieces; category enum; is_favorite for closet highlights.';
COMMENT ON TABLE outfits IS 'A worn look: worn_on = calendar day; occasion; image_url optional hero shot.';
COMMENT ON TABLE outfit_garments IS 'Links outfits to every garment in the look (required usage: insert one row per piece).';
COMMENT ON TABLE weekly_outfit_plans IS 'One row per calendar week (week_start = Monday); AI weekly outfit pipeline.';
COMMENT ON TABLE weekly_plan_looks IS 'Seven rows per plan (sort_order 0–6 = Mon–Sun); garment_ids from step 1.';
COMMENT ON TABLE google_batch_jobs IS 'Google Gemini Batch API job metadata for weekly hero image generation.';
