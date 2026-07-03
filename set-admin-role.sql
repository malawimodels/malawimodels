-- =====================================================
-- SET ADMIN ROLE MIGRATION
-- Sets the authorized admin email to have admin role
-- Execute this in Supabase SQL Editor
-- =====================================================

-- SECURITY: Update admin email to have admin role
-- Replace 'mphepobenedict@gmail.com' with your admin email if different
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
)
WHERE email = 'mphepobenedict@gmail.com';

-- Update the users table as well
UPDATE public.users
SET role = 'admin'
WHERE email = 'mphepobenedict@gmail.com';

-- Verify the update
SELECT 
    id,
    email,
    role,
    created_at,
    is_active,
    verified
FROM public.users
WHERE email = 'mphepobenedict@gmail.com';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- If you see a row with role='admin', the migration succeeded!
-- The admin user can now access the admin dashboard.
-- =====================================================
