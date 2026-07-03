# 🔧 COMPLETE SETUP AND FIX GUIDE

## Issues Fixed

### 1. ✅ Ambiguous Foreign Key Relationships
**Problem:** Models table had two FKs to users (id and agency_id), causing PostgREST to fail with PGRST201 error.

**Solution:** Added explicit FK constraint names:
- `fk_models_user` for model's own user record
- `fk_models_agency` for agency relationship
- Updated all queries to use `users!fk_models_user` syntax

### 2. ✅ Registration Profile Creation
**Problem:** Users created in auth.users but not in public.users table.

**Solution:** 
- Added automatic trigger `handle_new_user()` that creates public.users record on signup
- Pass role in signup metadata for trigger to use
- Keep manual profile creation as backup

### 3. ✅ Role Retrieval Failures
**Problem:** `.single()` query failed when user profile didn't exist yet, causing cascading errors.

**Solution:**
- Changed to `.maybeSingle()` to handle missing records gracefully
- Added retry logic with 3 attempts and 1-second delays
- Better error handling for 406 errors

### 4. ✅ Model Profile Missing Required Fields
**Problem:** Model profile creation failed because `district` field is required but not provided during registration.

**Solution:** Use default value "Not Specified" for initial registration, user can update later.

---

## 🚨 CRITICAL: MUST EXECUTE THESE STEPS IN ORDER

### Step 1: Clean Up Existing Data (IMPORTANT!)

Since you have a user in `auth.users` but not in `public.users`, you need to clean up:

1. **Go to Supabase Dashboard → Authentication → Users**
   - Find the user with ID `f4e1d77d-c14f-42b0-870e-ff15ae987459`
   - Delete this user (they can re-register after setup)

2. **OR use SQL Editor to delete:**
   ```sql
   -- Delete all auth users (safe since you said no production data)
   DELETE FROM auth.users;
   ```

### Step 2: Execute Updated Database Schema

**IMPORTANT:** The schema has been updated to fix the FK issues. You MUST drop existing tables first if you partially ran the old schema.

1. **Go to:** https://supabase.com/dashboard/project/kidesdvhevcdocjwbtek/sql/new

2. **Copy and paste this SQL:**

```sql
-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS agency_invitations CASCADE;
DROP TABLE IF EXISTS agency_applications CASCADE;
DROP TABLE IF EXISTS agency_request_photos CASCADE;
DROP TABLE IF EXISTS agency_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS booking_hidden_by CASCADE;
DROP TABLE IF EXISTS booking_negotiations CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS project_invitations CASCADE;
DROP TABLE IF EXISTS project_applications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS model_pricing CASCADE;
DROP TABLE IF EXISTS model_categories CASCADE;
DROP TABLE IF EXISTS model_images CASCADE;
DROP TABLE IF EXISTS models CASCADE;
DROP TABLE IF EXISTS gallery_images CASCADE;
DROP TABLE IF EXISTS custom_links CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_user_rating() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS search_models(TEXT[], TEXT[], TEXT[], TEXT[], INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
```

3. **Click "Run"** (or Cmd+Enter) - You should see "Success"

4. **Now run the complete schema from `supabase-schema.sql`:**
   - Copy **ALL** content from `/Users/benedictbreeze/Documents/website/malawimodels/supabase-schema.sql`
   - Paste into SQL Editor
   - Click "Run"
   - Wait for "Success. No rows returned"

### Step 3: Verify Database Setup

1. **Go to Table Editor** in Supabase sidebar

2. **You should see these 19 tables:**
   - ✅ users
   - ✅ custom_links
   - ✅ gallery_images
   - ✅ models
   - ✅ model_images
   - ✅ model_categories
   - ✅ model_pricing
   - ✅ projects
   - ✅ project_applications
   - ✅ project_invitations
   - ✅ bookings
   - ✅ booking_negotiations
   - ✅ booking_hidden_by
   - ✅ reviews
   - ✅ reports
   - ✅ notifications
   - ✅ agency_requests
   - ✅ agency_request_photos
   - ✅ agency_applications
   - ✅ agency_invitations
   - ✅ leave_requests

3. **Check the models table structure:**
   - Click on "models" table
   - Go to the "Constraints" tab (or look at schema)
   - Verify you see foreign keys named:
     - `fk_models_user`
     - `fk_models_agency`

### Step 4: Restart Dev Server

```bash
npm run dev
```

---

## 🧪 TESTING PROCEDURE

### Test 1: Register as Model

1. Open http://localhost:3000
2. Click "Register"
3. Fill in:
   - Name: "Test Model"
   - Email: "model@test.com"
   - Password: "password123"
   - Role: **Model**
4. Click "Create Account"

**Expected Result:**
- ✅ Account created successfully
- ✅ Redirected to `/dashboard`
- ✅ No console errors
- ✅ User appears in Supabase Auth
- ✅ User record in `public.users` table with role='model'
- ✅ User record in `models` table

**Check in Supabase:**
```sql
-- Check user was created
SELECT * FROM users WHERE email = 'model@test.com';

-- Check model profile was created
SELECT * FROM models WHERE id = (SELECT id FROM users WHERE email = 'model@test.com');
```

### Test 2: Register as Agency

1. Logout
2. Register with:
   - Name: "Test Agency"
   - Email: "agency@test.com"
   - Password: "password123"
   - Role: **Agency**

**Expected Result:**
- ✅ Redirected to `/agency-dashboard`
- ✅ User has role='agency'
- ✅ NO model profile created

### Test 3: Register as Client

1. Logout
2. Register with:
   - Name: "Test Client"
   - Email: "client@test.com"
   - Password: "password123"
   - Role: **Client**

**Expected Result:**
- ✅ Redirected to `/client-dashboard`
- ✅ User has role='client'

### Test 4: Login Redirects

**Model Login:**
- Email: model@test.com
- **Should redirect to:** `/dashboard`

**Agency Login:**
- Email: agency@test.com
- **Should redirect to:** `/agency-dashboard`

**Client Login:**
- Email: client@test.com
- **Should redirect to:** `/client-dashboard`

### Test 5: Dashboard Protection

Try accessing another role's dashboard while logged in:

**As Model, try to access:**
- `/agency-dashboard` → Should redirect to `/dashboard`
- `/client-dashboard` → Should redirect to `/dashboard`

**As Agency, try to access:**
- `/dashboard` → Should redirect to `/agency-dashboard`
- `/client-dashboard` → Should redirect to `/agency-dashboard`

### Test 6: Session Persistence

1. Login as any user
2. Refresh the page
3. **Expected:** Should remain logged in and stay on correct dashboard

---

## 🐛 Troubleshooting

### Error: "Could not find the table 'public.users'"
**Solution:** You didn't execute the SQL schema. Go to Step 2.

### Error: "User already registered"
**Solution:** Delete the user from Supabase Auth and try again. See Step 1.

### Error: "Cannot coerce the result to a single JSON object"
**Solution:** The public.users record doesn't exist. Delete the auth user and re-register.

### Error: "Could not embed because more than one relationship was found"
**Solution:** You're still using the old schema. Drop all tables (Step 2) and re-run the updated schema.

### Console shows 406 errors repeatedly
**Solution:** 
1. Check that tables exist in Supabase
2. Check that you're using the correct project URL and anon key in `.env.local`
3. Clear browser cache and restart dev server

### Profile creation fails
**Solution:** Check the Supabase logs (Logs → API in dashboard) to see the exact error. Common issues:
- RLS policies blocking insert
- Missing required fields
- Trigger not firing

---

## 📋 Files Modified

1. **supabase-schema.sql** - Fixed FK names, added profile creation trigger
2. **pages/Register.tsx** - Added role to signup metadata
3. **services/supabase.service.ts** - Fixed FK joins, made district optional, better error handling
4. **auth/AuthContext.tsx** - Added retry logic, changed .single() to .maybeSingle()

---

## 🔐 Admin Account Setup

To create an admin account:

1. Register normally as any role
2. Then run this SQL in Supabase:

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'youradmin@email.com';
```

---

## ✅ Success Checklist

- [ ] All tables created in Supabase
- [ ] Foreign key constraints named correctly
- [ ] Trigger `handle_new_user()` exists
- [ ] Model registration works → redirects to /dashboard
- [ ] Agency registration works → redirects to /agency-dashboard  
- [ ] Client registration works → redirects to /client-dashboard
- [ ] Login redirects to correct dashboard
- [ ] Role persists after page refresh
- [ ] No console errors during registration
- [ ] No console errors during login
- [ ] Dashboard protection works (can't access other roles' dashboards)

---

## 📞 Next Steps After Success

1. **Create Admin Account** (see above)
2. **Test Model Search** on homepage
3. **Test Project Creation** as Client
4. **Test Model Applications** to projects
5. **Test Booking Workflow**
6. **Configure Cloudinary** upload presets (optional, for image uploads)

---

## 🚀 Production Deployment

Before deploying to production:

1. **Update Supabase URL & Keys** in production environment
2. **Run schema on production database**
3. **Configure email templates** in Supabase Authentication settings
4. **Set up proper domain** for email confirmations
5. **Enable email confirmation** (currently disabled for testing)
6. **Review all RLS policies** for security
7. **Add rate limiting** on auth endpoints
8. **Set up monitoring** and error tracking

---

## 🎉 You're Done!

If all tests pass, your authentication system is fully working with:
- ✅ Role-based registration
- ✅ Role-based login redirects
- ✅ Dashboard protection
- ✅ Session persistence
- ✅ Profile auto-creation
- ✅ Proper error handling
