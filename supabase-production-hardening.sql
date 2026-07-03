-- =====================================================
-- MALAWI MODELS - PRODUCTION HARDENING MIGRATION
-- Security, audit, rate limits, persistent favorites,
-- availability, contracts, disputes, moderation, analytics foundations.
-- Execute in Supabase SQL Editor after supabase-schema.sql.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ADMIN PERMISSIONS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE admin_permission_role AS ENUM ('owner', 'admin', 'moderator', 'support', 'finance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role admin_permission_role NOT NULL DEFAULT 'admin',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_active
  ON admin_permissions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_role
  ON admin_permissions(role);

-- Bootstrap current platform owner. Remove or change after creating a second owner.
INSERT INTO admin_permissions (user_id, role, permissions, is_active)
SELECT id, 'owner', '{"all": true}'::jsonb, TRUE
FROM users
WHERE lower(email) = 'mphepobenedict@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = TRUE,
  revoked_at = NULL;

UPDATE users
SET role = 'admin'
WHERE lower(email) = 'mphepobenedict@gmail.com';

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_permissions ap
    WHERE ap.user_id = auth.uid()
      AND ap.is_active = TRUE
      AND ap.revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.my_admin_role()
RETURNS TEXT AS $$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT ap.role::TEXT INTO admin_role
  FROM admin_permissions ap
  WHERE ap.user_id = auth.uid()
    AND ap.is_active = TRUE
    AND ap.revoked_at IS NULL
  LIMIT 1;

  RETURN admin_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Block client-side/self role escalation. Admin/owner changes should be done
-- through controlled admin flows or SQL migrations.
CREATE OR REPLACE FUNCTION public.prevent_unsafe_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only platform administrators can change user roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_unsafe_role_change ON users;
CREATE TRIGGER trg_prevent_unsafe_role_change
BEFORE UPDATE OF role ON users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unsafe_role_change();

-- =====================================================
-- AUDIT LOGGING
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_table TEXT,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_created
  ON admin_audit_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_created
  ON admin_audit_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_created
  ON admin_audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON admin_audit_logs(target_table, target_id);

-- =====================================================
-- LIGHTWEIGHT RATE LIMITING
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope, identifier)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_scope_identifier
  ON rate_limits(scope, identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits(window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_scope TEXT,
  p_identifier TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  existing rate_limits%ROWTYPE;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO existing
  FROM rate_limits
  WHERE scope = p_scope AND identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rate_limits(scope, identifier, window_start, attempts, updated_at)
    VALUES (p_scope, p_identifier, now_ts, 1, now_ts);
    RETURN TRUE;
  END IF;

  IF existing.window_start < now_ts - (p_window_seconds || ' seconds')::INTERVAL THEN
    UPDATE rate_limits
    SET window_start = now_ts, attempts = 1, updated_at = now_ts
    WHERE id = existing.id;
    RETURN TRUE;
  END IF;

  IF existing.attempts >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limits
  SET attempts = attempts + 1, updated_at = now_ts
  WHERE id = existing.id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PERSISTENT FAVORITES / SHORTLISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS saved_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_models_user_created
  ON saved_models(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_models_model
  ON saved_models(model_id);

-- =====================================================
-- NOTIFICATION PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  project_updates BOOLEAN NOT NULL DEFAULT TRUE,
  booking_updates BOOLEAN NOT NULL DEFAULT TRUE,
  agency_updates BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MODEL AVAILABILITY
-- =====================================================

CREATE TABLE IF NOT EXISTS model_availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_model_availability_model_dates
  ON model_availability_blocks(model_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_model_availability_dates
  ON model_availability_blocks(start_date, end_date);

-- =====================================================
-- CONTRACTS, RELEASES, DISPUTES, MODERATION
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('booking_agreement', 'model_release', 'agency_agreement')),
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_type_active
  ON contract_templates(document_type, is_active);

CREATE TABLE IF NOT EXISTS booking_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('booking_agreement', 'model_release')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'void')),
  document_snapshot TEXT NOT NULL,
  client_accepted_at TIMESTAMPTZ,
  model_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_agreements_booking
  ON booking_agreements(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_agreements_status
  ON booking_agreements(status);

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  opened_by UUID REFERENCES users(id) ON DELETE SET NULL,
  against_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  reason TEXT NOT NULL,
  details TEXT,
  admin_decision TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_status_created
  ON disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_booking
  ON disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by
  ON disputes(opened_by);

CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cloudinary_url TEXT,
  cloudinary_public_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute
  ON dispute_evidence(dispute_id);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content_table TEXT,
  content_id UUID,
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  internal_notes TEXT,
  decision TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_status_created
  ON moderation_cases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_user
  ON moderation_cases(reported_user_id);

-- =====================================================
-- AGENCY TEAM / ONBOARDING / LIGHT ANALYTICS
-- =====================================================

CREATE TABLE IF NOT EXISTS agency_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_team_members_agency
  ON agency_team_members(agency_id, is_active);
CREATE INDEX IF NOT EXISTS idx_agency_team_members_user
  ON agency_team_members(user_id, is_active);

CREATE TABLE IF NOT EXISTS agency_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_agency_onboarding_agency
  ON agency_onboarding_tasks(agency_id, completed);

CREATE TABLE IF NOT EXISTS platform_daily_metrics (
  metric_date DATE PRIMARY KEY,
  active_users INTEGER NOT NULL DEFAULT 0,
  registrations INTEGER NOT NULL DEFAULT 0,
  projects_created INTEGER NOT NULL DEFAULT 0,
  applications_created INTEGER NOT NULL DEFAULT 0,
  bookings_created INTEGER NOT NULL DEFAULT 0,
  reports_created INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SOFT DELETE COLUMNS
-- =====================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_status_created
  ON projects(deleted_at, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_status_updated
  ON bookings(deleted_at, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_deleted_status_created
  ON reports(deleted_at, status, created_at DESC);

-- =====================================================
-- ADVANCED SEARCH SUPPORT INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_models_search_core
  ON models(availability, district, gender, age, height, agency_id, ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_model_pricing_price
  ON model_pricing(category, price);
CREATE INDEX IF NOT EXISTS idx_users_verified_role_active
  ON users(verified, role, is_active);

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Existing tables: ensure RLS remains enabled.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_permissions" ON admin_permissions;
CREATE POLICY "admins_read_permissions" ON admin_permissions
  FOR SELECT USING (public.is_platform_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "owners_manage_permissions" ON admin_permissions;
CREATE POLICY "owners_manage_permissions" ON admin_permissions
  FOR ALL USING (public.my_admin_role() = 'owner')
  WITH CHECK (public.my_admin_role() = 'owner');

DROP POLICY IF EXISTS "admins_read_audit_logs" ON admin_audit_logs;
CREATE POLICY "admins_read_audit_logs" ON admin_audit_logs
  FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "admins_create_audit_logs" ON admin_audit_logs;
CREATE POLICY "admins_create_audit_logs" ON admin_audit_logs
  FOR INSERT WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "users_manage_saved_models" ON saved_models;
CREATE POLICY "users_manage_saved_models" ON saved_models
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_notification_preferences" ON notification_preferences;
CREATE POLICY "users_manage_notification_preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "models_manage_own_availability" ON model_availability_blocks;
CREATE POLICY "models_manage_own_availability" ON model_availability_blocks
  FOR ALL USING (model_id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (model_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "clients_read_model_availability" ON model_availability_blocks;
CREATE POLICY "clients_read_model_availability" ON model_availability_blocks
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admins_manage_contract_templates" ON contract_templates;
CREATE POLICY "admins_manage_contract_templates" ON contract_templates
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "booking_participants_read_agreements" ON booking_agreements;
CREATE POLICY "booking_participants_read_agreements" ON booking_agreements
  FOR SELECT USING (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (b.client_id = auth.uid() OR b.model_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "booking_participants_manage_agreements" ON booking_agreements;
CREATE POLICY "booking_participants_manage_agreements" ON booking_agreements
  FOR UPDATE USING (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (b.client_id = auth.uid() OR b.model_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "dispute_participants_read" ON disputes;
CREATE POLICY "dispute_participants_read" ON disputes
  FOR SELECT USING (
    public.is_platform_admin() OR opened_by = auth.uid() OR against_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "users_create_disputes" ON disputes;
CREATE POLICY "users_create_disputes" ON disputes
  FOR INSERT WITH CHECK (opened_by = auth.uid());

DROP POLICY IF EXISTS "admins_update_disputes" ON disputes;
CREATE POLICY "admins_update_disputes" ON disputes
  FOR UPDATE USING (public.is_platform_admin());

DROP POLICY IF EXISTS "dispute_evidence_participants_read" ON dispute_evidence;
CREATE POLICY "dispute_evidence_participants_read" ON dispute_evidence
  FOR SELECT USING (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_id
        AND (d.opened_by = auth.uid() OR d.against_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "dispute_evidence_participants_insert" ON dispute_evidence;
CREATE POLICY "dispute_evidence_participants_insert" ON dispute_evidence
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "admins_manage_moderation_cases" ON moderation_cases;
CREATE POLICY "admins_manage_moderation_cases" ON moderation_cases
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "agency_team_members_read" ON agency_team_members;
CREATE POLICY "agency_team_members_read" ON agency_team_members
  FOR SELECT USING (public.is_platform_admin() OR user_id = auth.uid() OR agency_id = auth.uid());

DROP POLICY IF EXISTS "agency_owner_manage_team" ON agency_team_members;
CREATE POLICY "agency_owner_manage_team" ON agency_team_members
  FOR ALL USING (public.is_platform_admin() OR agency_id = auth.uid())
  WITH CHECK (public.is_platform_admin() OR agency_id = auth.uid());

DROP POLICY IF EXISTS "agency_manage_onboarding" ON agency_onboarding_tasks;
CREATE POLICY "agency_manage_onboarding" ON agency_onboarding_tasks
  FOR ALL USING (public.is_platform_admin() OR agency_id = auth.uid())
  WITH CHECK (public.is_platform_admin() OR agency_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_platform_metrics" ON platform_daily_metrics;
CREATE POLICY "admins_read_platform_metrics" ON platform_daily_metrics
  FOR SELECT USING (public.is_platform_admin());

-- Tighten existing user update behavior: owner can update own safe profile
-- fields, while role changes are blocked by trigger for non-admins.
DROP POLICY IF EXISTS "Admins have full access to users" ON users;
CREATE POLICY "Admins have full access to users" ON users
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Soft-delete aware admin reads are enforced in app queries too; policies remain permissive for admins.

SELECT 'production hardening migration ready' AS status;
