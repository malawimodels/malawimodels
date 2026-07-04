-- =====================================================
-- REALTIME BOOKINGS + REVIEW ELIGIBILITY MIGRATION
-- Run this in Supabase SQL Editor after supabase-schema.sql.
-- =====================================================

-- Booking metadata needed for review eligibility and cancellation history.
ALTER TABLE models ADD COLUMN IF NOT EXISTS profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON bookings(event_date) WHERE event_date IS NOT NULL;

-- Review lifecycle: one review per booking/author remains enforced by the
-- existing UNIQUE(booking_id, author_id); edit_count allows one later change.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0 CHECK (edit_count >= 0);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE reports ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check CHECK (reason IN (
  'Non-payment', 'Partial payment only', 'Harassment', 'Agreement violation', 'Unsafe conditions', 'Other',
  'INAPPROPRIATE_BEHAVIOR', 'SCAM', 'FAKE_PROFILE', 'HARASSMENT', 'OTHER'
));

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN ('PENDING', 'REVIEWED', 'WARNING_SENT', 'ACTION_TAKEN', 'RESOLVED'));

CREATE INDEX IF NOT EXISTS idx_reports_booking ON reports(booking_id) WHERE booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_review_edit_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.edit_count >= 1 THEN
    RAISE EXCEPTION 'You have already edited this review once.';
  END IF;

  NEW.edit_count = OLD.edit_count + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_review_edit_limit_trigger ON reviews;
CREATE TRIGGER enforce_review_edit_limit_trigger
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION enforce_review_edit_limit();

-- Reviews are allowed only for real booking participants after a legitimate
-- outcome: completed, cancelled/reported, or once the booking date has passed.
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews"
ON reviews FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND booking_id IN (
    SELECT id FROM bookings
    WHERE (model_id = auth.uid() OR client_id = auth.uid())
      AND (
        status IN ('completed', 'cancelled', 'reported')
        OR (event_date IS NOT NULL AND event_date <= CURRENT_DATE)
      )
  )
);

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
ON reviews FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Server-side model search used by the landing talent directory. The frontend
-- falls back to direct selects if this function has not been deployed yet.
CREATE OR REPLACE FUNCTION search_models_paginated(
  p_categories TEXT[] DEFAULT NULL,
  p_districts TEXT[] DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_skin_tones TEXT[] DEFAULT NULL,
  p_min_height INTEGER DEFAULT 0,
  p_max_height INTEGER DEFAULT 300,
  p_min_age INTEGER DEFAULT NULL,
  p_max_age INTEGER DEFAULT NULL,
  p_min_rate INTEGER DEFAULT NULL,
  p_max_rate INTEGER DEFAULT NULL,
  p_verified_only BOOLEAN DEFAULT FALSE,
  p_agency_represented BOOLEAN DEFAULT NULL,
  p_only_available BOOLEAN DEFAULT FALSE,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  bio TEXT,
  verified BOOLEAN,
  is_active BOOLEAN,
  public_email TEXT,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  average_rating DECIMAL,
  reviews_count INTEGER,
  total_projects INTEGER,
  completed_projects INTEGER,
  age INTEGER,
  height INTEGER,
  gender TEXT,
  skin_tone TEXT,
  district TEXT,
  city TEXT,
  agency_id UUID,
  agency_name TEXT,
  availability BOOLEAN,
  profile_image_url TEXT,
  video_reel_url TEXT,
  views INTEGER,
  ranking_score DECIMAL,
  profile_completeness INTEGER,
  created_at TIMESTAMPTZ,
  categories TEXT[],
  pricing JSONB,
  images TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    u.display_name,
    u.email,
    u.bio,
    u.verified,
    u.is_active,
    u.public_email,
    u.whatsapp,
    u.instagram,
    u.facebook,
    u.website,
    u.average_rating,
    u.reviews_count,
    u.total_projects,
    u.completed_projects,
    NULL::INTEGER AS age,
    m.height,
    m.gender,
    m.skin_tone,
    m.district,
    m.city,
    m.agency_id,
    m.agency_name,
    m.availability,
    m.profile_image_url,
    m.video_reel_url,
    m.views,
    m.ranking_score,
    COALESCE(m.profile_completeness, 0),
    m.created_at,
    COALESCE((
      SELECT array_agg(DISTINCT mc.category)
      FROM model_categories mc
      WHERE mc.model_id = m.id
    ), ARRAY[]::TEXT[]),
    COALESCE((
      SELECT jsonb_object_agg(mp.category, mp.price)
      FROM model_pricing mp
      WHERE mp.model_id = m.id
    ), '{}'::JSONB),
    COALESCE((
      SELECT array_agg(mi.cloudinary_url ORDER BY mi.display_order)
      FROM model_images mi
      WHERE mi.model_id = m.id
    ), ARRAY[]::TEXT[])
  FROM models m
  JOIN users u ON u.id = m.id
  WHERE u.is_active = TRUE
    AND (p_categories IS NULL OR EXISTS (
      SELECT 1 FROM model_categories mc WHERE mc.model_id = m.id AND mc.category = ANY(p_categories)
    ))
    AND (p_districts IS NULL OR m.district = ANY(p_districts))
    AND (p_gender IS NULL OR m.gender = p_gender)
    AND (p_skin_tones IS NULL OR m.skin_tone = ANY(p_skin_tones))
    AND (p_min_height <= 0 OR m.height >= p_min_height)
    AND (p_max_height >= 300 OR m.height <= p_max_height)
    AND (NOT p_verified_only OR u.verified = TRUE)
    AND (p_agency_represented IS NULL OR (p_agency_represented = TRUE AND m.agency_id IS NOT NULL) OR (p_agency_represented = FALSE AND m.agency_id IS NULL))
    AND (NOT p_only_available OR m.availability = TRUE)
    AND (p_min_rate IS NULL OR EXISTS (
      SELECT 1 FROM model_pricing mp WHERE mp.model_id = m.id AND mp.price >= p_min_rate
    ))
    AND (p_max_rate IS NULL OR EXISTS (
      SELECT 1 FROM model_pricing mp WHERE mp.model_id = m.id AND mp.price <= p_max_rate
    ))
  ORDER BY m.ranking_score DESC, u.average_rating DESC, m.created_at DESC
  OFFSET GREATEST(p_offset, 0)
  LIMIT GREATEST(p_limit, 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Supabase Realtime only emits table events for tables in the realtime
-- publication. Add the tables used by the live talent, project, booking, and
-- review subscriptions if they are not already present.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'models',
    'model_categories',
    'model_images',
    'projects',
    'project_applications',
    'project_invitations',
    'bookings',
    'booking_negotiations',
    'booking_hidden_by',
    'reviews'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
