# 🚨 Database Setup Required - Execute This First!

## The Problem

Your app is trying to access database tables that don't exist yet:
- `users` table - doesn't exist
- `models` table - doesn't exist
- All 19 tables need to be created

## The Solution

Execute the SQL schema in your Supabase dashboard.

---

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/kidesdvhevcdocjwbtek/sql/new**

Or manually:
1. Go to https://supabase.com/dashboard
2. Click your project: `kidesdvhevcdocjwbtek`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Copy the SQL Schema

Open `MIGRATION_PLAN.md` in this project and copy **lines 9 to 1085** (the entire SQL section).

Or copy the SQL below:

```sql
-- =====================================================
-- SUPABASE DATABASE SCHEMA
-- Execute this entire file in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: users (Core user accounts for all roles)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('model', 'client', 'agency', 'admin')),
    display_name TEXT DEFAULT '',
    photo_url TEXT,
    bio TEXT,
    verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Contact info
    public_email TEXT,
    whatsapp TEXT,
    instagram TEXT,
    facebook TEXT,
    website TEXT,
    
    -- Stats
    average_rating NUMERIC(3,2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
    reviews_count INTEGER DEFAULT 0,
    total_projects INTEGER DEFAULT 0,
    completed_projects INTEGER DEFAULT 0,
    total_hired INTEGER DEFAULT 0,
    
    -- Admin tracking
    warning_count INTEGER DEFAULT 0,
    deletion_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- =====================================================
-- TABLE: custom_links (Additional social links)
-- =====================================================
CREATE TABLE IF NOT EXISTS custom_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_links_user ON custom_links(user_id);

-- =====================================================
-- TABLE: gallery_images (Separate images from user profile)
-- =====================================================
CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cloudinary_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_user ON gallery_images(user_id);

-- =====================================================
-- TABLE: models (Model-specific profile data)
-- =====================================================
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Profile image
    profile_image_url TEXT,
    
    -- Physical attributes
    height INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    skin_tone TEXT,
    
    -- Location
    district TEXT,
    city TEXT,
    
    -- Agency relationship
    agency_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agency_name TEXT,
    
    -- Availability
    availability BOOLEAN DEFAULT TRUE,
    
    -- Media
    video_reel_url TEXT,
    
    -- Stats
    views INTEGER DEFAULT 0,
    ranking_score NUMERIC(10,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_models_agency ON models(agency_id);
CREATE INDEX IF NOT EXISTS idx_models_gender ON models(gender);
CREATE INDEX IF NOT EXISTS idx_models_district ON models(district);
CREATE INDEX IF NOT EXISTS idx_models_availability ON models(availability);
CREATE INDEX IF NOT EXISTS idx_models_ranking ON models(ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_models_height ON models(height);
CREATE INDEX IF NOT EXISTS idx_models_skin_tone ON models(skin_tone);

-- =====================================================
-- TABLE: model_images (Model portfolio/gallery images)
-- =====================================================
CREATE TABLE IF NOT EXISTS model_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    cloudinary_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_images_model ON model_images(model_id);

-- =====================================================
-- TABLE: model_categories (Many-to-many relationship)
-- =====================================================
CREATE TABLE IF NOT EXISTS model_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, category)
);

CREATE INDEX IF NOT EXISTS idx_model_categories_model ON model_categories(model_id);
CREATE INDEX IF NOT EXISTS idx_model_categories_category ON model_categories(category);

-- =====================================================
-- TABLE: model_pricing (Pricing per category)
-- =====================================================
CREATE TABLE IF NOT EXISTS model_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, category)
);

CREATE INDEX IF NOT EXISTS idx_model_pricing_model ON model_pricing(model_id);

-- =====================================================
-- TABLE: projects (Casting calls / job postings)
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL,
    owner_photo_url TEXT,
    owner_verified BOOLEAN DEFAULT FALSE,
    
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    location TEXT,
    dates TEXT,
    event_date TIMESTAMPTZ,
    
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    visibility TEXT DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_event_date ON projects(event_date);

-- =====================================================
-- TABLE: project_applications (Model applications to projects)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    model_photo_url TEXT,
    note TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(project_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_project_applications_project ON project_applications(project_id);
CREATE INDEX IF NOT EXISTS idx_project_applications_model ON project_applications(model_id);
CREATE INDEX IF NOT EXISTS idx_project_applications_status ON project_applications(status);

-- =====================================================
-- TABLE: project_invitations (Direct model invites)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(project_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_model ON project_invitations(model_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON project_invitations(status);

-- =====================================================
-- TABLE: bookings (Confirmed jobs)
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_title TEXT NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    
    status TEXT DEFAULT 'NEGOTIATING' CHECK (status IN ('NEGOTIATING', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
    
    -- Current offer tracking
    current_offer_amount INTEGER,
    current_offer_by TEXT CHECK (current_offer_by IN ('model', 'client')),
    current_offer_at TIMESTAMPTZ,
    
    -- Payment proof
    payment_proof_url TEXT,
    
    -- Reviews
    model_review_id UUID,
    client_review_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_project ON bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_model ON bookings(model_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- =====================================================
-- TABLE: booking_negotiations (Offer history)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_negotiations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    offered_by TEXT NOT NULL CHECK (offered_by IN ('model', 'client')),
    amount INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_negotiations_booking ON booking_negotiations(booking_id);

-- =====================================================
-- TABLE: booking_hidden_by (Track who archived a booking)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_hidden_by (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_hidden_booking ON booking_hidden_by(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_hidden_user ON booking_hidden_by(user_id);

-- =====================================================
-- TABLE: reviews (User ratings)
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user ON reviews(reviewed_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);

-- =====================================================
-- TABLE: reports (User reports for misconduct)
-- =====================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reporter_role TEXT NOT NULL,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_role TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- TABLE: agency_requests (Agency registration requests)
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    applicant_name TEXT NOT NULL,
    agency_name TEXT NOT NULL,
    logo_url TEXT,
    bio TEXT,
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

CREATE INDEX IF NOT EXISTS idx_agency_requests_applicant ON agency_requests(applicant_id);
CREATE INDEX IF NOT EXISTS idx_agency_requests_status ON agency_requests(status);

-- =====================================================
-- TABLE: agency_request_photos (Agency portfolio images)
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_request_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES agency_requests(id) ON DELETE CASCADE,
    cloudinary_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_request_photos_request ON agency_request_photos(request_id);

-- =====================================================
-- TABLE: agency_applications (Model applies to join agency)
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_applications (
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

CREATE INDEX IF NOT EXISTS idx_agency_applications_model ON agency_applications(model_id);
CREATE INDEX IF NOT EXISTS idx_agency_applications_agency ON agency_applications(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_applications_status ON agency_applications(status);

-- =====================================================
-- TABLE: agency_invitations (Agency invites model)
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_name TEXT NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(agency_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_invitations_agency ON agency_invitations(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_invitations_model ON agency_invitations(model_id);
CREATE INDEX IF NOT EXISTS idx_agency_invitations_status ON agency_invitations(status);

-- =====================================================
-- TABLE: leave_requests (Model requests to leave agency)
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_requests (
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

CREATE INDEX IF NOT EXISTS idx_leave_requests_model ON leave_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_agency ON leave_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- =====================================================
-- TRIGGERS: Auto-update timestamps
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGERS: Update user rating when new review is added
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating), 0)
            FROM reviews
            WHERE reviewed_user_id = NEW.reviewed_user_id
        ),
        reviews_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE reviewed_user_id = NEW.reviewed_user_id
        )
    WHERE id = NEW.reviewed_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review_insert
    AFTER INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_user_rating();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
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

-- USERS table policies
CREATE POLICY "Users can view all active users" ON users
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- MODELS table policies
CREATE POLICY "Anyone can view active models" ON models
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = models.id AND users.is_active = true)
    );

CREATE POLICY "Models can update their own profile" ON models
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Models can insert their own profile" ON models
    FOR INSERT WITH CHECK (auth.uid() = id);

-- MODEL IMAGES policies
CREATE POLICY "Anyone can view model images" ON model_images
    FOR SELECT USING (true);

CREATE POLICY "Models can manage their own images" ON model_images
    FOR ALL USING (auth.uid() = model_id);

-- MODEL CATEGORIES policies
CREATE POLICY "Anyone can view model categories" ON model_categories
    FOR SELECT USING (true);

CREATE POLICY "Models can manage their own categories" ON model_categories
    FOR ALL USING (auth.uid() = model_id);

-- MODEL PRICING policies
CREATE POLICY "Anyone can view model pricing" ON model_pricing
    FOR SELECT USING (true);

CREATE POLICY "Models can manage their own pricing" ON model_pricing
    FOR ALL USING (auth.uid() = model_id);

-- PROJECTS policies
CREATE POLICY "Anyone can view public projects" ON projects
    FOR SELECT USING (visibility = 'PUBLIC' OR owner_id = auth.uid());

CREATE POLICY "Clients can create projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their projects" ON projects
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their projects" ON projects
    FOR DELETE USING (auth.uid() = owner_id);

-- PROJECT APPLICATIONS policies
CREATE POLICY "Models can view applications for their projects" ON project_applications
    FOR SELECT USING (
        model_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.owner_id = auth.uid())
    );

CREATE POLICY "Models can create applications" ON project_applications
    FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Project owners can update applications" ON project_applications
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.owner_id = auth.uid())
    );

-- PROJECT INVITATIONS policies  
CREATE POLICY "Models and clients can view their invitations" ON project_invitations
    FOR SELECT USING (
        model_id = auth.uid() OR
        EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.owner_id = auth.uid())
    );

CREATE POLICY "Project owners can create invitations" ON project_invitations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.owner_id = auth.uid())
    );

CREATE POLICY "Models can update invitation status" ON project_invitations
    FOR UPDATE USING (auth.uid() = model_id);

-- BOOKINGS policies
CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (model_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Clients can create bookings" ON bookings
    FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Participants can update bookings" ON bookings
    FOR UPDATE USING (model_id = auth.uid() OR client_id = auth.uid());

-- BOOKING NEGOTIATIONS policies
CREATE POLICY "Participants can view negotiations" ON booking_negotiations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM bookings 
            WHERE bookings.id = booking_id 
            AND (bookings.model_id = auth.uid() OR bookings.client_id = auth.uid())
        )
    );

CREATE POLICY "Participants can create negotiations" ON booking_negotiations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM bookings 
            WHERE bookings.id = booking_id 
            AND (bookings.model_id = auth.uid() OR bookings.client_id = auth.uid())
        )
    );

-- BOOKING HIDDEN BY policies
CREATE POLICY "Users can view their own hidden bookings" ON booking_hidden_by
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can hide bookings" ON booking_hidden_by
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- REVIEWS policies
CREATE POLICY "Anyone can view reviews" ON reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- REPORTS policies
CREATE POLICY "Users can view their own reports" ON reports
    FOR SELECT USING (reporter_id = auth.uid() OR reported_user_id = auth.uid());

CREATE POLICY "Users can create reports" ON reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- NOTIFICATIONS policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- AGENCY REQUESTS policies
CREATE POLICY "Anyone can view pending agency requests" ON agency_requests
    FOR SELECT USING (true);

CREATE POLICY "Users can create agency requests" ON agency_requests
    FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicants can view their requests" ON agency_requests
    FOR UPDATE USING (auth.uid() = applicant_id);

-- AGENCY APPLICATIONS policies
CREATE POLICY "Models and agencies can view applications" ON agency_applications
    FOR SELECT USING (model_id = auth.uid() OR agency_id = auth.uid());

CREATE POLICY "Models can create applications" ON agency_applications
    FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Agencies can respond to applications" ON agency_applications
    FOR UPDATE USING (auth.uid() = agency_id);

-- AGENCY INVITATIONS policies
CREATE POLICY "Models and agencies can view invitations" ON agency_invitations
    FOR SELECT USING (model_id = auth.uid() OR agency_id = auth.uid());

CREATE POLICY "Agencies can create invitations" ON agency_invitations
    FOR INSERT WITH CHECK (auth.uid() = agency_id);

CREATE POLICY "Models can respond to invitations" ON agency_invitations
    FOR UPDATE USING (auth.uid() = model_id);

-- LEAVE REQUESTS policies
CREATE POLICY "Models and agencies can view leave requests" ON leave_requests
    FOR SELECT USING (model_id = auth.uid() OR agency_id = auth.uid());

CREATE POLICY "Models can create leave requests" ON leave_requests
    FOR INSERT WITH CHECK (auth.uid() = model_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function for complex model search
CREATE OR REPLACE FUNCTION search_models(
    search_categories TEXT[] DEFAULT NULL,
    search_districts TEXT[] DEFAULT NULL,
    search_genders TEXT[] DEFAULT NULL,
    search_skin_tones TEXT[] DEFAULT NULL,
    min_height_val INTEGER DEFAULT NULL,
    max_height_val INTEGER DEFAULT NULL,
    only_available BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    profile_image_url TEXT,
    height INTEGER,
    gender TEXT,
    skin_tone TEXT,
    district TEXT,
    city TEXT,
    agency_id UUID,
    agency_name TEXT,
    availability BOOLEAN,
    video_reel_url TEXT,
    views INTEGER,
    ranking_score NUMERIC,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT m.*
    FROM models m
    INNER JOIN users u ON u.id = m.id
    LEFT JOIN model_categories mc ON mc.model_id = m.id
    WHERE u.is_active = true
        AND (search_categories IS NULL OR mc.category = ANY(search_categories))
        AND (search_districts IS NULL OR m.district = ANY(search_districts))
        AND (search_genders IS NULL OR m.gender = ANY(search_genders))
        AND (search_skin_tones IS NULL OR m.skin_tone = ANY(search_skin_tones))
        AND (min_height_val IS NULL OR m.height >= min_height_val)
        AND (max_height_val IS NULL OR m.height <= max_height_val)
        AND (NOT only_available OR m.availability = true)
    ORDER BY m.ranking_score DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETE! Your database is ready.
-- =====================================================
```

### 3. Execute the SQL

1. Paste the SQL into the Supabase SQL Editor
2. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
3. Wait for it to complete (should take 5-10 seconds)

You should see: **"Success. No rows returned"**

### 4. Verify Tables Were Created

In the Supabase dashboard, click **Table Editor** in the left sidebar. You should see 19 tables:
- users
- models
- projects
- bookings
- notifications
- (and 14 more)

### 5. Restart Your Dev Server

```bash
npm run dev
```

Now the app should work! The database tables exist and the app can query them.

---

## Expected Result

After executing the schema:
- ✅ No more "table not found" errors
- ✅ Registration will work
- ✅ Login will work
- ✅ All database queries will succeed

---

## If You Still See Errors

Check:
1. Did the SQL run successfully without errors?
2. Are all 19 tables visible in Table Editor?
3. Is Row Level Security enabled? (it should be)
4. Try refreshing your browser after restarting the dev server
