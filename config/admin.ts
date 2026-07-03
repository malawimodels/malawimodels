/**
 * ADMIN CONFIGURATION
 * 
 * ⚠️ SECURITY CRITICAL ⚠️
 * This file defines the authorized admin email address.
 * Only this email can access admin dashboard and perform admin actions.
 * 
 * IMPORTANT: This is enforced at multiple levels:
 * 1. Frontend checks (Layout, Admin page)
 * 2. AuthContext role assignment
 * 3. Database RLS policies (Supabase)
 * 
 * To change admin email:
 * 1. Update ADMIN_EMAIL constant below
 * 2. Run the migration: set-admin-role.sql
 * 3. Login with the new email
 */

/**
 * The ONE AND ONLY authorized admin email address.
 * Must be lowercase to ensure case-insensitive matching.
 */
export const ADMIN_EMAIL = 'mphepobenedict@gmail.com';

/**
 * Check if a given email is the authorized admin.
 * Case-insensitive comparison.
 * 
 * @param email - Email to check
 * @returns true if email is the admin, false otherwise
 */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
};

/**
 * Legacy support: Array format for compatibility.
 * @deprecated Use ADMIN_EMAIL or isAdminEmail() instead
 */
export const ADMIN_EMAILS = [ADMIN_EMAIL];
