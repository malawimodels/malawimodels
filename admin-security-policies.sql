-- =====================================================
-- ADMIN SECURITY POLICIES (RLS)
-- Enforce admin-only access at the database level
-- Execute this in Supabase SQL Editor AFTER set-admin-role.sql
-- =====================================================

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the authenticated user has admin role
  RETURN (
    SELECT role = 'admin'
    FROM public.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is admin by email
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the authenticated user's email matches admin email
  RETURN (
    SELECT email = 'mphepobenedict@gmail.com'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ADMIN POLICIES: Users Table
-- =====================================================

-- Admin can read all users
CREATE POLICY "admin_read_all_users" ON public.users
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- Admin can update any user (for verification, blocking, etc.)
CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE
  USING (is_admin() OR is_admin_email());

-- Admin can delete users
CREATE POLICY "admin_delete_users" ON public.users
  FOR DELETE
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- ADMIN POLICIES: Projects Table
-- =====================================================

-- Admin can read all projects
CREATE POLICY "admin_read_all_projects" ON public.projects
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- Admin can delete any project
CREATE POLICY "admin_delete_projects" ON public.projects
  FOR DELETE
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- ADMIN POLICIES: Agency Requests Table
-- =====================================================

-- Admin can read all agency requests
CREATE POLICY "admin_read_agency_requests" ON public.agency_requests
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- Admin can update agency requests (approve/reject)
CREATE POLICY "admin_update_agency_requests" ON public.agency_requests
  FOR UPDATE
  USING (is_admin() OR is_admin_email());

-- Admin can delete agency requests
CREATE POLICY "admin_delete_agency_requests" ON public.agency_requests
  FOR DELETE
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- ADMIN POLICIES: Reports Table
-- =====================================================

-- Admin can read all reports
CREATE POLICY "admin_read_reports" ON public.reports
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- Admin can update reports (change status)
CREATE POLICY "admin_update_reports" ON public.reports
  FOR UPDATE
  USING (is_admin() OR is_admin_email());

-- Admin can delete reports
CREATE POLICY "admin_delete_reports" ON public.reports
  FOR DELETE
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- ADMIN POLICIES: Leave Requests Table
-- =====================================================

-- Admin can read all leave requests
CREATE POLICY "admin_read_leave_requests" ON public.leave_requests
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- Admin can update leave requests (approve/reject)
CREATE POLICY "admin_update_leave_requests" ON public.leave_requests
  FOR UPDATE
  USING (is_admin() OR is_admin_email());

-- Admin can delete leave requests
CREATE POLICY "admin_delete_leave_requests" ON public.leave_requests
  FOR DELETE
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- ADMIN POLICIES: Models Table
-- =====================================================

-- Admin can read all model profiles
CREATE POLICY "admin_read_models" ON public.models
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- Admin can update model profiles
CREATE POLICY "admin_update_models" ON public.models
  FOR UPDATE
  USING (is_admin() OR is_admin_email());

-- Admin can delete model profiles
CREATE POLICY "admin_delete_models" ON public.models
  FOR DELETE
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- ADMIN POLICIES: Notifications Table
-- =====================================================

-- Admin can create notifications for any user
CREATE POLICY "admin_create_notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (is_admin() OR is_admin_email());

-- Admin can read all notifications
CREATE POLICY "admin_read_notifications" ON public.notifications
  FOR SELECT
  USING (is_admin() OR is_admin_email());

-- =====================================================
-- VERIFY POLICIES
-- =====================================================

-- List all policies for admin verification
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE policyname LIKE 'admin_%'
ORDER BY tablename, policyname;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Admin security policies have been created!
-- Only users with admin role or admin email can perform admin operations.
-- This provides multi-layer security:
-- 1. Frontend checks (Layout, Admin page)
-- 2. AuthContext role enforcement
-- 3. Database RLS policies (this file)
-- =====================================================
