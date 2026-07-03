# ✅ QUICK ACTION CHECKLIST

## 🚨 STEP 1: CLEAN UP (Required)

Delete the corrupt auth user that exists without a profile:

```sql
-- Go to: https://supabase.com/dashboard/project/kidesdvhevcdocjwbtek/sql/new
-- Paste and run:
DELETE FROM auth.users;
```

---

## 🚨 STEP 2: EXECUTE SQL SCHEMA (CRITICAL - BLOCKING ALL ELSE)

1. **Go to:** https://supabase.com/dashboard/project/kidesdvhevcdocjwbtek/sql/new

2. **First, drop any partially created tables:**

```sql
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
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_user_rating() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS search_models(TEXT[], TEXT[], TEXT[], TEXT[], INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
```

3. **Click "Run"**

4. **Now copy ALL content from `supabase-schema.sql`**

5. **Paste into SQL Editor**

6. **Click "Run"**

7. **Wait for "Success"**

8. **Verify:** Go to Table Editor sidebar - should see 19 tables

---

## 🧪 STEP 3: RESTART DEV SERVER

```bash
npm run dev
```

---

## ✅ STEP 4: TEST MODEL REGISTRATION

1. Open http://localhost:3000
2. Click "Register"
3. Fill:
   - Name: Test Model
   - Email: model@test.com
   - Password: password123
   - Role: **Model**
4. Click "Create Account"

**Expected:**
- ✅ Success notification
- ✅ Redirects to `/dashboard`
- ✅ No console errors

---

## ✅ STEP 5: TEST AGENCY REGISTRATION

1. Logout
2. Register:
   - Name: Test Agency
   - Email: agency@test.com
   - Password: password123
   - Role: **Agency**

**Expected:**
- ✅ Redirects to `/agency-dashboard`

---

## ✅ STEP 6: TEST CLIENT REGISTRATION

1. Logout
2. Register:
   - Name: Test Client
   - Email: client@test.com
   - Password: password123
   - Role: **Client**

**Expected:**
- ✅ Redirects to `/client-dashboard`

---

## ✅ STEP 7: TEST LOGIN REDIRECTS

### Model Login
- Email: model@test.com
- Password: password123
- **Should go to:** `/dashboard`

### Agency Login
- Email: agency@test.com
- Password: password123
- **Should go to:** `/agency-dashboard`

### Client Login
- Email: client@test.com
- Password: password123
- **Should go to:** `/client-dashboard`

---

## ✅ STEP 8: TEST DASHBOARD PROTECTION

### Login as Model
- Try to access: `/agency-dashboard`
- **Should redirect to:** `/dashboard`

### Login as Agency
- Try to access: `/dashboard`
- **Should redirect to:** `/agency-dashboard`

### Login as Client
- Try to access: `/dashboard`
- **Should redirect to:** `/client-dashboard`

---

## ✅ STEP 9: TEST SESSION PERSISTENCE

1. Login as any user
2. **Refresh the page**
3. **Should:** Stay logged in on correct dashboard

---

## ✅ STEP 10: VERIFY IN SUPABASE

### Check Users Table
```sql
SELECT id, email, role, display_name FROM users;
```

**Should see:**
- model@test.com with role='model'
- agency@test.com with role='agency'
- client@test.com with role='client'

### Check Models Table
```sql
SELECT * FROM models;
```

**Should see:**
- One record for the model user
- No records for agency or client

---

## 🎉 SUCCESS CRITERIA

All of these should be ✅:

- [ ] 19 tables created in Supabase
- [ ] Trigger `handle_new_user()` exists
- [ ] Model registration works
- [ ] Agency registration works
- [ ] Client registration works
- [ ] Login redirects correctly for all roles
- [ ] Dashboard protection works
- [ ] Session persists after refresh
- [ ] No console errors
- [ ] Users appear in database with correct roles

---

## 🐛 TROUBLESHOOTING

### Error: "Could not find the table 'public.users'"
**Fix:** You didn't execute the SQL in Step 2

### Error: "User already registered"
**Fix:** Delete the user from Step 1 again

### Error: "Cannot coerce the result to a single JSON object"
**Fix:** Profile wasn't created. Delete auth user and re-register

### Console shows 406 errors
**Fix:** 
1. Verify tables exist in Supabase
2. Restart dev server
3. Clear browser cache

---

## 🔥 IF ALL ELSE FAILS

1. **Delete all auth users:**
   ```sql
   DELETE FROM auth.users;
   ```

2. **Drop and recreate all tables** (Step 2)

3. **Restart dev server**

4. **Clear browser cache** (Cmd+Shift+R on Mac)

5. **Try registration again**

---

## 📚 DETAILED GUIDES

- **Complete Setup:** [SETUP_AND_FIX_GUIDE.md](SETUP_AND_FIX_GUIDE.md)
- **Technical Details:** [AUTHENTICATION_FIXES_SUMMARY.md](AUTHENTICATION_FIXES_SUMMARY.md)
- **Database Schema:** [supabase-schema.sql](supabase-schema.sql)

---

## 🆘 NEED HELP?

Check console errors and compare against:
- Expected: No errors
- If errors: Open SETUP_AND_FIX_GUIDE.md → Troubleshooting section
