# FIREBASE → SUPABASE + CLOUDINARY MIGRATION PLAN

## PHASE 1: DATABASE SCHEMA DESIGN

### PostgreSQL Schema (Production-Ready, Normalized)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- =====================================================
-- USERS TABLE (Core user data for all roles)
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
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
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Physical Attributes
  height INTEGER CHECK (height > 0 AND height < 300),
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  skin_tone TEXT CHECK (skin_tone IN ('Light', 'Medium', 'Dark', 'Very Dark')),
  
  -- Location
  district TEXT NOT NULL,
  city TEXT,
  
  -- Agency Relationship
  agency_id UUID REFERENCES users(id) ON DELETE SET NULL,
  agency_name TEXT,
  
  -- Availability
  availability BOOLEAN DEFAULT TRUE,
  
  -- Media (Cloudinary URLs)
  profile_image_url TEXT,
  video_reel_url TEXT, -- YouTube URL
  
  -- Analytics
  views INTEGER DEFAULT 0,
  ranking_score DECIMAL(10,2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_models_agency ON models(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX idx_models_availability ON models(availability) WHERE availability = TRUE;
CREATE INDEX idx_models_district ON models(district);
CREATE INDEX idx_models_gender ON models(gender);
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
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT max_6_images CHECK ((SELECT COUNT(*) FROM model_images WHERE model_id = model_images.model_id) <= 6)
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
  dates TEXT, -- Human-readable date range
  event_date DATE, -- Strict date for filtering
  
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
  payment_proof_url TEXT, -- Cloudinary URL
  
  -- Reviews (foreign keys to reviews table)
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
  
  UNIQUE(booking_id, author_id) -- One review per booking per author
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
  logo_url TEXT, -- Cloudinary URL
  bio TEXT NOT NULL,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  member_count_male INTEGER DEFAULT 0,
  member_count_female INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_agency_requests_applicant ON agency_requests(applicant_id);
CREATE INDEX idx_agency_requests_status ON agency_requests(status);

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

-- Function to get models by filters (replaces Firestore query)
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

```

## PHASE 2: ROW LEVEL SECURITY (RLS) POLICIES

### Security Principles
1. **Principle of Least Privilege** - Users can only access what they need
2. **Role-Based Access** - Permissions based on user role
3. **Owner-Based Access** - Users own their data
4. **Admin Override** - Admins have elevated permissions

```sql
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

-- Users can read all active users (for directory/search)
CREATE POLICY "Users can view active users"
ON users FOR SELECT
USING (is_active = TRUE);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = auth.uid());

-- Admins can do anything
CREATE POLICY "Admins have full access to users"
ON users FOR ALL
USING (is_admin());

-- Users can insert their own profile (during registration)
CREATE POLICY "Users can create own profile"
ON users FOR INSERT
WITH CHECK (id = auth.uid());

-- =====================================================
-- MODELS TABLE POLICIES
-- =====================================================

-- Anyone can view models (public directory)
CREATE POLICY "Anyone can view models"
ON models FOR SELECT
USING (TRUE);

-- Models can update their own profile
CREATE POLICY "Models can update own profile"
ON models FOR UPDATE
USING (id = auth.uid());

-- Models can insert their own profile
CREATE POLICY "Models can create own profile"
ON models FOR INSERT
WITH CHECK (id = auth.uid());

-- Admins can do anything
CREATE POLICY "Admins have full access to models"
ON models FOR ALL
USING (is_admin());

-- =====================================================
-- MODEL IMAGES POLICIES
-- =====================================================

-- Anyone can view model images
CREATE POLICY "Anyone can view model images"
ON model_images FOR SELECT
USING (TRUE);

-- Models can manage their own images
CREATE POLICY "Models can manage own images"
ON model_images FOR ALL
USING (model_id = auth.uid());

-- =====================================================
-- MODEL CATEGORIES POLICIES
-- =====================================================

-- Anyone can view
CREATE POLICY "Anyone can view model categories"
ON model_categories FOR SELECT
USING (TRUE);

-- Models can manage their own categories
CREATE POLICY "Models can manage own categories"
ON model_categories FOR ALL
USING (model_id = auth.uid());

-- =====================================================
-- MODEL PRICING POLICIES
-- =====================================================

-- Anyone can view pricing
CREATE POLICY "Anyone can view model pricing"
ON model_pricing FOR SELECT
USING (TRUE);

-- Models can manage their own pricing
CREATE POLICY "Models can manage own pricing"
ON model_pricing FOR ALL
USING (model_id = auth.uid());

-- =====================================================
-- PROJECTS TABLE POLICIES
-- =====================================================

-- Anyone can view open public projects
CREATE POLICY "Anyone can view public projects"
ON projects FOR SELECT
USING (visibility = 'PUBLIC' AND status = 'OPEN');

-- Project owners can view their own projects
CREATE POLICY "Owners can view own projects"
ON projects FOR SELECT
USING (owner_id = auth.uid());

-- Clients can create projects
CREATE POLICY "Clients can create projects"
ON projects FOR INSERT
WITH CHECK (owner_id = auth.uid() AND get_my_role() = 'client');

-- Owners can update their own projects
CREATE POLICY "Owners can update own projects"
ON projects FOR UPDATE
USING (owner_id = auth.uid());

-- Owners can delete their own projects
CREATE POLICY "Owners can delete own projects"
ON projects FOR DELETE
USING (owner_id = auth.uid());

-- Admins have full access
CREATE POLICY "Admins have full access to projects"
ON projects FOR ALL
USING (is_admin());

-- =====================================================
-- PROJECT APPLICATIONS POLICIES
-- =====================================================

-- Models can view their own applications
CREATE POLICY "Models can view own applications"
ON project_applications FOR SELECT
USING (model_id = auth.uid());

-- Project owners can view applications to their projects
CREATE POLICY "Owners can view project applications"
ON project_applications FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

-- Models can create applications
CREATE POLICY "Models can apply to projects"
ON project_applications FOR INSERT
WITH CHECK (model_id = auth.uid());

-- Project owners can update applications (approve/reject)
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

-- Models can view invitations sent to them
CREATE POLICY "Models can view own invitations"
ON project_invitations FOR SELECT
USING (model_id = auth.uid());

-- Project owners can view invitations they sent
CREATE POLICY "Owners can view sent invitations"
ON project_invitations FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

-- Project owners can create invitations
CREATE POLICY "Owners can invite models"
ON project_invitations FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
  )
);

-- Models can update invitations (accept/decline)
CREATE POLICY "Models can respond to invitations"
ON project_invitations FOR UPDATE
USING (model_id = auth.uid());

-- =====================================================
-- BOOKINGS POLICIES
-- =====================================================

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
ON bookings FOR SELECT
USING (model_id = auth.uid() OR client_id = auth.uid());

-- Bookings are created by project owner when approving
CREATE POLICY "Clients can create bookings"
ON bookings FOR INSERT
WITH CHECK (client_id = auth.uid());

-- Participants can update bookings
CREATE POLICY "Participants can update bookings"
ON bookings FOR UPDATE
USING (model_id = auth.uid() OR client_id = auth.uid());

-- Admins have full access
CREATE POLICY "Admins have full access to bookings"
ON bookings FOR ALL
USING (is_admin());

-- =====================================================
-- BOOKING NEGOTIATIONS POLICIES
-- =====================================================

-- Users can view negotiations for their bookings
CREATE POLICY "Users can view booking negotiations"
ON booking_negotiations FOR SELECT
USING (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE model_id = auth.uid() OR client_id = auth.uid()
  )
);

-- Users can create negotiation offers
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

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews"
ON reviews FOR SELECT
USING (TRUE);

-- Users can create reviews for their completed bookings
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

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON reviews FOR UPDATE
USING (author_id = auth.uid());

-- =====================================================
-- REPORTS POLICIES
-- =====================================================

-- Users can view reports they created
CREATE POLICY "Users can view own reports"
ON reports FOR SELECT
USING (reporter_id = auth.uid());

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON reports FOR SELECT
USING (is_admin());

-- Users can create reports
CREATE POLICY "Users can create reports"
ON reports FOR INSERT
WITH CHECK (reporter_id = auth.uid());

-- Admins can update reports
CREATE POLICY "Admins can update reports"
ON reports FOR UPDATE
USING (is_admin());

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid());

-- System can create notifications for any user
-- (This will be handled via service role key in backend)
CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (TRUE);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (user_id = auth.uid());

-- =====================================================
-- AGENCY REQUESTS POLICIES
-- =====================================================

-- Users can view their own requests
CREATE POLICY "Users can view own agency requests"
ON agency_requests FOR SELECT
USING (applicant_id = auth.uid());

-- Admins can view all requests
CREATE POLICY "Admins can view all agency requests"
ON agency_requests FOR SELECT
USING (is_admin());

-- Models can create agency requests
CREATE POLICY "Models can create agency requests"
ON agency_requests FOR INSERT
WITH CHECK (applicant_id = auth.uid() AND get_my_role() = 'model');

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update agency requests"
ON agency_requests FOR UPDATE
USING (is_admin());

-- =====================================================
-- AGENCY APPLICATIONS POLICIES
-- =====================================================

-- Models can view their own applications
CREATE POLICY "Models can view own applications"
ON agency_applications FOR SELECT
USING (model_id = auth.uid());

-- Agencies can view applications to them
CREATE POLICY "Agencies can view incoming applications"
ON agency_applications FOR SELECT
USING (agency_id = auth.uid());

-- Models can create applications
CREATE POLICY "Models can apply to agencies"
ON agency_applications FOR INSERT
WITH CHECK (model_id = auth.uid());

-- Agencies can update applications (accept/reject)
CREATE POLICY "Agencies can respond to applications"
ON agency_applications FOR UPDATE
USING (agency_id = auth.uid());

-- =====================================================
-- AGENCY INVITATIONS POLICIES
-- =====================================================

-- Models can view invitations sent to them
CREATE POLICY "Models can view agency invitations"
ON agency_invitations FOR SELECT
USING (model_id = auth.uid());

-- Agencies can view invitations they sent
CREATE POLICY "Agencies can view sent invitations"
ON agency_invitations FOR SELECT
USING (agency_id = auth.uid());

-- Agencies can create invitations
CREATE POLICY "Agencies can invite models"
ON agency_invitations FOR INSERT
WITH CHECK (agency_id = auth.uid() AND get_my_role() = 'agency');

-- Models can respond to invitations
CREATE POLICY "Models can respond to invitations"
ON agency_invitations FOR UPDATE
USING (model_id = auth.uid());

-- =====================================================
-- LEAVE REQUESTS POLICIES
-- =====================================================

-- Models can view their own requests
CREATE POLICY "Models can view own leave requests"
ON leave_requests FOR SELECT
USING (model_id = auth.uid());

-- Agencies can view requests from their models
CREATE POLICY "Agencies can view model leave requests"
ON leave_requests FOR SELECT
USING (agency_id = auth.uid());

-- Admins can view all leave requests
CREATE POLICY "Admins can view all leave requests"
ON leave_requests FOR SELECT
USING (is_admin());

-- Models can create leave requests
CREATE POLICY "Models can create leave requests"
ON leave_requests FOR INSERT
WITH CHECK (model_id = auth.uid());

-- Admins can process leave requests
CREATE POLICY "Admins can process leave requests"
ON leave_requests FOR UPDATE
USING (is_admin());
```

## PHASE 3: SETUP INSTRUCTIONS

### A. Supabase Setup

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Note down:
     - Project URL: `https://xxxxx.supabase.co`
     - Anon Key: `eyJhbG...` (public key for client)
     - Service Role Key: `eyJhbG...` (private key for admin operations)

2. **Run Schema Migration**
   - Go to SQL Editor in Supabase Dashboard
   - Copy and paste the entire schema SQL above
   - Execute

3. **Configure Authentication**
   - Go to Authentication > Settings
   - Enable Email provider
   - Configure email templates
   - Set Site URL to your production domain
   - Add redirect URLs

4. **Environment Variables**
   Create `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...
   ```

### B. Cloudinary Setup

1. **Create Cloudinary Account**
   - Go to https://cloudinary.com
   - Sign up for free account
   - Go to Dashboard
   - Note down:
     - Cloud Name: `dxxxxxx`
     - API Key: `123456789`
     - API Secret: `abcdefg...`

2. **Create Upload Presets**
   - Go to Settings > Upload
   - Create preset: `malawi_models_profiles`
     - Signing Mode: Unsigned
     - Folder: `profiles/`
     - Transformations: `c_fill,w_800,h_800,q_auto`
   - Create preset: `malawi_models_gallery`
     - Signing Mode: Unsigned
     - Folder: `gallery/`
     - Transformations: `c_fill,w_1200,h_1200,q_auto`
   - Create preset: `malawi_models_payments`
     - Signing Mode: Unsigned
     - Folder: `payments/`
     - Transformations: `q_auto`

3. **Environment Variables**
   Add to `.env.local`:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=dxxxxxx
   VITE_CLOUDINARY_UPLOAD_PRESET_PROFILE=malawi_models_profiles
   VITE_CLOUDINARY_UPLOAD_PRESET_GALLERY=malawi_models_gallery
   VITE_CLOUDINARY_UPLOAD_PRESET_PAYMENT=malawi_models_payments
   ```

## PHASE 4: MIGRATION SEQUENCE

1. ✅ Schema created and RLS policies applied
2. ⏳ Install new dependencies
3. ⏳ Create Supabase client service
4. ⏳ Create Cloudinary upload service
5. ⏳ Migrate AuthContext to Supabase Auth
6. ⏳ Migrate all Firestore service functions to Supabase
7. ⏳ Update all components and pages
8. ⏳ Remove Firebase completely
9. ⏳ Test all features
10. ⏳ Production deployment

---

**Next Steps:**
1. Complete Supabase setup
2. Complete Cloudinary setup
3. Provide credentials for .env.local
4. Begin code migration

