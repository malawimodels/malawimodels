-- Production models table does not include age. Keep the RPC response shape
-- stable for the frontend, but return NULL for age and ignore age filters.
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
