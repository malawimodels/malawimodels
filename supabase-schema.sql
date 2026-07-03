-- =====================================================
-- MALAWI MODELS - SUPABASE DATABASE SCHEMA
-- Execute this file in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE (Core user data for all roles)
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  display_name_changed_at TIMESTAMPTZ,
  role TEXT NOT NULL CHECK (role IN ('model', 'client', 'agency', 'admin')),
  photo_url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Contact Information
  public_email TEXT,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  
  -- Statistics (denormalized for performance)
  average_rating DECIMAL(3,2) DEFAULT 0.00 CHECK (average_rating >= 0 AND average_rating <= 5),
  reviews_count INTEGER DEFAULT 0,
  total_projects INTEGER DEFAULT 0,
  completed_projects INTEGER DEFAULT 0,
  total_hired INTEGER DEFAULT 0,
  
  -- Moderation
  warning_count INTEGER DEFAULT 0,
  deletion_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verified ON users(verified) WHERE verified = TRUE;
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- =====================================================
-- CUSTOM LINKS (Dynamic social/portfolio links)
-- =====================================================
CREATE TABLE custom_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_links_user ON custom_links(user_id);

-- =====================================================
-- GALLERY (Agency/User portfolio images - URLs only)
-- =====================================================
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gallery_user ON gallery_images(user_id);

-- =====================================================
-- MODELS TABLE (Extended profile for talent)
-- =====================================================
CREATE TABLE models (
  id UUID PRIMARY KEY,
  
  -- Physical Attributes
  age INTEGER CHECK (age IS NULL OR (age >= 16 AND age <= 65)),
  height INTEGER CHECK (height > 0 AND height < 300),
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  skin_tone TEXT CHECK (skin_tone IN ('Light', 'Medium', 'Dark', 'Very Dark')),
  
  -- Location
  district TEXT NOT NULL,
  city TEXT,
  
  -- Agency Relationship
  agency_id UUID,
  agency_name TEXT,
  
  -- Availability
  availability BOOLEAN DEFAULT TRUE,
  
  -- Media (Cloudinary URLs)
  profile_image_url TEXT,
  video_reel_url TEXT,
  
  -- Analytics
  views INTEGER DEFAULT 0,
  ranking_score DECIMAL(10,2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign Keys with explicit names to avoid ambiguity
  CONSTRAINT fk_models_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_models_agency FOREIGN KEY (agency_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_models_agency ON models(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX idx_models_availability ON models(availability) WHERE availability = TRUE;
CREATE INDEX idx_models_district ON models(district);
CREATE INDEX idx_models_gender ON models(gender);
CREATE INDEX idx_models_age ON models(age);
CREATE INDEX idx_models_ranking ON models(ranking_score DESC);

-- =====================================================
-- MODEL IMAGES (Multiple portfolio photos)
-- =====================================================
CREATE TABLE model_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_images_model ON model_images(model_id);

-- =====================================================
-- MODEL CATEGORIES (Many-to-many relationship)
-- =====================================================
CREATE TABLE model_categories (
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'Fashion', 'Editorial', 'Commercial', 'Runway', 
    'Fitness', 'Glamour', 'Plus Size', 'Print', 'Other'
  )),
  PRIMARY KEY (model_id, category)
);

CREATE INDEX idx_model_categories_category ON model_categories(category);

-- =====================================================
-- MODEL PRICING (Price per category)
-- =====================================================
CREATE TABLE model_pricing (
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  currency TEXT DEFAULT 'MWK',
  PRIMARY KEY (model_id, category)
);

CREATE INDEX idx_model_pricing_category ON model_pricing(category);

-- =====================================================
-- PROJECTS (Casting calls/job postings)
-- =====================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner Information (denormalized for performance)
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  owner_photo_url TEXT,
  owner_verified BOOLEAN DEFAULT FALSE,
  
  -- Project Details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  dates TEXT,
  event_date DATE,
  
  -- Status
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
  visibility TEXT DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_location ON projects(location);
CREATE INDEX idx_projects_event_date ON projects(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- =====================================================
-- PROJECT APPLICATIONS (Models applying to projects)
-- =====================================================
CREATE TABLE project_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, model_id)
);

CREATE INDEX idx_project_applications_project ON project_applications(project_id);
CREATE INDEX idx_project_applications_model ON project_applications(model_id);
CREATE INDEX idx_project_applications_status ON project_applications(status);

-- =====================================================
-- PROJECT INVITATIONS (Client inviting models)
-- =====================================================
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  
  UNIQUE(project_id, model_id)
);

CREATE INDEX idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX idx_project_invitations_model ON project_invitations(model_id);
CREATE INDEX idx_project_invitations_status ON project_invitations(status);

-- =====================================================
-- BOOKINGS (Negotiation & payment tracking)
-- =====================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationships
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'negotiating' CHECK (status IN (
    'negotiating', 'scheduled', 'completed', 'cancelled', 'reported'
  )),
  
  -- Current Offer
  current_offer_amount INTEGER DEFAULT 0,
  current_offer_by TEXT CHECK (current_offer_by IN ('model', 'client')),
  current_offer_at TIMESTAMPTZ,
  
  -- Payment
  payment_proof_url TEXT,
  
  -- Reviews
  model_review_id UUID,
  client_review_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, model_id)
);

CREATE INDEX idx_bookings_model ON bookings(model_id);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_project ON bookings(project_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_updated ON bookings(updated_at DESC);

-- =====================================================
-- BOOKING NEGOTIATIONS (Offer history/chat)
-- =====================================================
CREATE TABLE booking_negotiations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('model', 'client')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_negotiations_booking ON booking_negotiations(booking_id);
CREATE INDEX idx_booking_negotiations_created ON booking_negotiations(created_at);

-- =====================================================
-- BOOKING VISIBILITY (Archive/hide feature)
-- =====================================================
CREATE TABLE booking_hidden_by (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (booking_id, user_id)
);

CREATE INDEX idx_booking_hidden_booking ON booking_hidden_by(booking_id);

-- =====================================================
-- REVIEWS (Rating system)
-- =====================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL CHECK (target_role IN ('model', 'client')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(booking_id, author_id)
);

CREATE INDEX idx_reviews_target ON reviews(target_id);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- =====================================================
-- REPORTS (User reporting system)
-- =====================================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_role TEXT NOT NULL,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_role TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'INAPPROPRIATE_BEHAVIOR', 'SCAM', 'FAKE_PROFILE', 'HARASSMENT', 'OTHER'
  )),
  details TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created ON reports(created_at DESC);

-- =====================================================
-- NOTIFICATIONS (In-app notifications)
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- AGENCY REQUESTS (New agency registration)
-- =====================================================
CREATE TABLE agency_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  logo_url TEXT,
  bio TEXT NOT NULL,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  tiktok TEXT,
  website TEXT,
  location TEXT,
  member_count_male INTEGER DEFAULT 0,
  member_count_female INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_agency_requests_applicant ON agency_requests(applicant_id);
CREATE INDEX idx_agency_requests_status ON agency_requests(status);
CREATE INDEX idx_agency_requests_location ON agency_requests(location);

-- =====================================================
-- AGENCY REQUEST PHOTOS (Portfolio images for application)
-- =====================================================
CREATE TABLE agency_request_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES agency_requests(id) ON DELETE CASCADE,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_agency_request_photos_request ON agency_request_photos(request_id);

-- =====================================================
-- AGENCY APPLICATIONS (Models applying to agencies)
-- =====================================================
CREATE TABLE agency_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_photo_url TEXT,
  agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  
  UNIQUE(model_id, agency_id)
);

CREATE INDEX idx_agency_applications_model ON agency_applications(model_id);
CREATE INDEX idx_agency_applications_agency ON agency_applications(agency_id);
CREATE INDEX idx_agency_applications_status ON agency_applications(status);

-- =====================================================
-- AGENCY INVITATIONS (Agencies inviting models)
-- =====================================================
CREATE TABLE agency_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  
  UNIQUE(agency_id, model_id)
);

CREATE INDEX idx_agency_invitations_model ON agency_invitations(model_id);
CREATE INDEX idx_agency_invitations_agency ON agency_invitations(agency_id);
CREATE INDEX idx_agency_invitations_status ON agency_invitations(status);

-- =====================================================
-- LEAVE REQUESTS (Models leaving agencies)
-- =====================================================
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_leave_requests_model ON leave_requests(model_id);
CREATE INDEX idx_leave_requests_agency ON leave_requests(agency_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

-- =====================================================
-- TRIGGERS: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGERS: Maintain user statistics
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews
      WHERE target_id = NEW.target_id
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE target_id = NEW.target_id
    )
  WHERE id = NEW.target_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_inserted_trigger
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_user_rating();

CREATE TRIGGER review_updated_trigger
AFTER UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- =====================================================
-- FUNCTIONS: Helper functions for complex queries
-- =====================================================

-- Function to get models by filters
CREATE OR REPLACE FUNCTION search_models(
  p_categories TEXT[] DEFAULT NULL,
  p_districts TEXT[] DEFAULT NULL,
  p_genders TEXT[] DEFAULT NULL,
  p_skin_tones TEXT[] DEFAULT NULL,
  p_min_height INTEGER DEFAULT 0,
  p_max_height INTEGER DEFAULT 300,
  p_only_available BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  photo_url TEXT,
  height INTEGER,
  gender TEXT,
  skin_tone TEXT,
  district TEXT,
  city TEXT,
  agency_id UUID,
  agency_name TEXT,
  availability BOOLEAN,
  views INTEGER,
  ranking_score DECIMAL,
  average_rating DECIMAL,
  reviews_count INTEGER,
  categories TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    u.display_name,
    m.profile_image_url AS photo_url,
    m.height,
    m.gender,
    m.skin_tone,
    m.district,
    m.city,
    m.agency_id,
    m.agency_name,
    m.availability,
    m.views,
    m.ranking_score,
    u.average_rating,
    u.reviews_count,
    ARRAY_AGG(DISTINCT mc.category) AS categories
  FROM models m
  JOIN users u ON m.id = u.id
  LEFT JOIN model_categories mc ON m.id = mc.model_id
  WHERE 
    u.is_active = TRUE
    AND (p_categories IS NULL OR mc.category = ANY(p_categories))
    AND (p_districts IS NULL OR m.district = ANY(p_districts))
    AND (p_genders IS NULL OR m.gender = ANY(p_genders))
    AND (p_skin_tones IS NULL OR m.skin_tone = ANY(p_skin_tones))
    AND m.height >= p_min_height
    AND m.height <= p_max_height
    AND (NOT p_only_available OR m.availability = TRUE)
  GROUP BY m.id, u.display_name, u.average_rating, u.reviews_count
  ORDER BY m.ranking_score DESC, u.average_rating DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_hidden_by ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_request_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role
    FROM users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view active users"
ON users FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Admins have full access to users"
ON users FOR ALL
USING (is_admin());

CREATE POLICY "Users can create own profile"
ON users FOR INSERT
WITH CHECK (id = auth.uid());

-- =====================================================
-- MODELS TABLE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view models"
ON models FOR SELECT
USING (TRUE);

CREATE POLICY "Models can update own profile"
ON models FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Models can create own profile"
ON models FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins have full access to models"
ON models FOR ALL
USING (is_admin());

-- =====================================================
-- MODEL IMAGES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view model images"
ON model_images FOR SELECT
USING (TRUE);

CREATE POLICY "Models can manage own images"
ON model_images FOR ALL
USING (model_id = auth.uid());

-- =====================================================
-- MODEL CATEGORIES POLICIES
-- =====================================================

CREATE POLICY "Anyone can view model categories"
ON model_categories FOR SELECT
USING (TRUE);

CREATE POLICY "Models can manage own categories"
ON model_categories FOR ALL
USING (model_id = auth.uid());

-- =====================================================
-- MODEL PRICING POLICIES
-- =====================================================

CREATE POLICY "Anyone can view model pricing"
ON model_pricing FOR SELECT
USING (TRUE);

CREATE POLICY "Models can manage own pricing"
ON model_pricing FOR ALL
USING (model_id = auth.uid());

-- =====================================================
-- PROJECTS TABLE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view public projects"
ON projects FOR SELECT
USING (visibility = 'PUBLIC' AND status = 'OPEN');

CREATE POLICY "Owners can view own projects"
ON projects FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Clients can create projects"
ON projects FOR INSERT
WITH CHECK (owner_id = auth.uid() AND get_my_role() = 'client');

CREATE POLICY "Owners can update own projects"
ON projects FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete own projects"
ON projects FOR DELETE
USING (owner_id = auth.uid());

CREATE POLICY "Admins have full access to projects"
ON projects FOR ALL
USING (is_admin());

-- =====================================================
-- PROJECT APPLICATIONS POLICIES
-- =====================================================

CREATE POLICY "Models can view own applications"
ON project_applications FOR SELECT
USING (model_id = auth.uid());

CREATE POLICY "Owners can view project applications"
ON project_applications FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Models can apply to projects"
ON project_applications FOR INSERT
WITH CHECK (model_id = auth.uid());

CREATE POLICY "Owners can update applications"
ON project_applications FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

-- =====================================================
-- PROJECT INVITATIONS POLICIES
-- =====================================================

CREATE POLICY "Models can view own invitations"
ON project_invitations FOR SELECT
USING (model_id = auth.uid());

CREATE POLICY "Owners can view sent invitations"
ON project_invitations FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can invite models"
ON project_invitations FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Models can respond to invitations"
ON project_invitations FOR UPDATE
USING (model_id = auth.uid());

-- =====================================================
-- BOOKINGS POLICIES
-- =====================================================

CREATE POLICY "Users can view own bookings"
ON bookings FOR SELECT
USING (model_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Clients can create bookings"
ON bookings FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Participants can update bookings"
ON bookings FOR UPDATE
USING (model_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Admins have full access to bookings"
ON bookings FOR ALL
USING (is_admin());

-- =====================================================
-- BOOKING NEGOTIATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view booking negotiations"
ON booking_negotiations FOR SELECT
USING (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE model_id = auth.uid() OR client_id = auth.uid()
  )
);

CREATE POLICY "Users can create negotiation offers"
ON booking_negotiations FOR INSERT
WITH CHECK (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE model_id = auth.uid() OR client_id = auth.uid()
  )
);

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view reviews"
ON reviews FOR SELECT
USING (TRUE);

CREATE POLICY "Users can create reviews"
ON reviews FOR INSERT
WITH CHECK (
  author_id = auth.uid() AND
  booking_id IN (
    SELECT id FROM bookings 
    WHERE (model_id = auth.uid() OR client_id = auth.uid())
    AND status = 'completed'
  )
);

CREATE POLICY "Users can update own reviews"
ON reviews FOR UPDATE
USING (author_id = auth.uid());

-- =====================================================
-- REPORTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own reports"
ON reports FOR SELECT
USING (reporter_id = auth.uid());

CREATE POLICY "Admins can view all reports"
ON reports FOR SELECT
USING (is_admin());

CREATE POLICY "Users can create reports"
ON reports FOR INSERT
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins can update reports"
ON reports FOR UPDATE
USING (is_admin());

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (user_id = auth.uid());

-- =====================================================
-- AGENCY REQUESTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own agency requests"
ON agency_requests FOR SELECT
USING (applicant_id = auth.uid());

CREATE POLICY "Admins can view all agency requests"
ON agency_requests FOR SELECT
USING (is_admin());

CREATE POLICY "Models can create agency requests"
ON agency_requests FOR INSERT
WITH CHECK (applicant_id = auth.uid() AND get_my_role() = 'model');

CREATE POLICY "Admins can update agency requests"
ON agency_requests FOR UPDATE
USING (is_admin());

-- =====================================================
-- AGENCY APPLICATIONS POLICIES
-- =====================================================

CREATE POLICY "Models can view own applications"
ON agency_applications FOR SELECT
USING (model_id = auth.uid());

CREATE POLICY "Agencies can view incoming applications"
ON agency_applications FOR SELECT
USING (agency_id = auth.uid());

CREATE POLICY "Models can apply to agencies"
ON agency_applications FOR INSERT
WITH CHECK (model_id = auth.uid());

CREATE POLICY "Agencies can respond to applications"
ON agency_applications FOR UPDATE
USING (agency_id = auth.uid());

-- =====================================================
-- AGENCY INVITATIONS POLICIES
-- =====================================================

CREATE POLICY "Models can view agency invitations"
ON agency_invitations FOR SELECT
USING (model_id = auth.uid());

CREATE POLICY "Agencies can view sent invitations"
ON agency_invitations FOR SELECT
USING (agency_id = auth.uid());

CREATE POLICY "Agencies can invite models"
ON agency_invitations FOR INSERT
WITH CHECK (agency_id = auth.uid() AND get_my_role() = 'agency');

CREATE POLICY "Models can respond to invitations"
ON agency_invitations FOR UPDATE
USING (model_id = auth.uid());

-- =====================================================
-- LEAVE REQUESTS POLICIES
-- =====================================================

CREATE POLICY "Models can view own leave requests"
ON leave_requests FOR SELECT
USING (model_id = auth.uid());

CREATE POLICY "Agencies can view model leave requests"
ON leave_requests FOR SELECT
USING (agency_id = auth.uid());

CREATE POLICY "Admins can view all leave requests"
ON leave_requests FOR SELECT
USING (is_admin());

CREATE POLICY "Models can create leave requests"
ON leave_requests FOR INSERT
WITH CHECK (model_id = auth.uid());

CREATE POLICY "Admins can process leave requests"
ON leave_requests FOR UPDATE
USING (is_admin());

-- =====================================================
-- TRIGGER: Auto-create user profile on auth signup
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- COMPLETE! Your database is ready.
-- =====================================================
