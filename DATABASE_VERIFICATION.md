# Database Verification Checklist

After running the SQL schema, use this checklist to verify everything is set up correctly.

## Step 1: Verify Tables Exist

Go to: https://supabase.com/dashboard/project/kidesdvhevcdocjwbtek/editor

**Check these 19 tables exist:**
- [ ] users
- [ ] custom_links
- [ ] gallery_images
- [ ] models
- [ ] model_images
- [ ] model_categories
- [ ] model_pricing
- [ ] projects
- [ ] project_applications
- [ ] project_invitations
- [ ] bookings
- [ ] booking_negotiations
- [ ] booking_hidden_by
- [ ] reviews
- [ ] reports
- [ ] notifications
- [ ] agency_requests
- [ ] agency_request_photos
- [ ] agency_applications
- [ ] agency_invitations
- [ ] leave_requests

## Step 2: Verify Foreign Key Constraints

Run this SQL to check FK names:

```sql
SELECT
    tc.table_name, 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'models'
ORDER BY tc.table_name, tc.constraint_name;
```

**You should see:**
- [ ] `fk_models_user` - models.id → users.id
- [ ] `fk_models_agency` - models.agency_id → users.id

## Step 3: Verify Trigger Exists

Run this SQL:

```sql
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**You should see:**
- [ ] Trigger named `on_auth_user_created`
- [ ] On table `users` in schema `auth`
- [ ] Executes `handle_new_user()`

## Step 4: Verify Trigger Function Exists

Run this SQL:

```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';
```

**You should see:**
- [ ] Function `handle_new_user` exists
- [ ] Contains INSERT INTO public.users logic

## Step 5: Test Registration

1. **Delete any test users** first:
```sql
DELETE FROM auth.users WHERE email LIKE '%test%';
DELETE FROM public.users WHERE email LIKE '%test%';
```

2. **Register a new test user:**
   - Go to http://localhost:3000
   - Click Register
   - Fill: test@example.com / test123456 / Model role
   - Click Create Account

3. **Verify user was created in BOTH tables:**

```sql
-- Check auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'test@example.com';

-- Check public.users
SELECT id, email, role, display_name, created_at 
FROM public.users 
WHERE email = 'test@example.com';
```

**Both queries should return 1 row with matching IDs**

## Step 6: Verify Console Has No Errors

Open browser console (F12) and check:

- [ ] No PGRST200 errors (schema not found)
- [ ] No PGRST201 errors (ambiguous relationship)
- [ ] No 22P02 errors (invalid UUID)
- [ ] No 406 errors (Not Acceptable)
- [ ] No "User profile not found" messages

## Step 7: Verify Dashboard Loads

After successful registration:

- [ ] Redirected to /dashboard
- [ ] Overview tab shows stats
- [ ] Profile tab shows user info
- [ ] Opportunities tab loads (may be empty)
- [ ] Bookings tab loads (may be empty)
- [ ] No "Loading..." stuck forever

## Common Issues & Fixes

### Issue: Tables don't exist
**Fix:** You didn't run the SQL schema. Go back to URGENT_FIX_NOW.md Step 3.

### Issue: FK constraints have wrong names
**Fix:** You ran the old schema. Drop tables and run new schema from supabase-schema.sql.

### Issue: Trigger doesn't exist
**Fix:** You didn't run the complete schema. Make sure you copied ALL 986 lines.

### Issue: User created in auth.users but not public.users
**Fix:** Trigger isn't working. Check trigger exists (Step 3). If it exists but doesn't work, try this:
```sql
-- Manually create the missing user
INSERT INTO public.users (id, email, role, display_name, created_at)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'role', 'guest'),
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
    created_at
FROM auth.users
WHERE email = 'your@email.com';
```

### Issue: Still getting PGRST201 errors
**Fix:** PostgREST schema cache needs refresh. Run:
```sql
NOTIFY pgrst, 'reload schema';
```

### Issue: Dashboard shows "undefined" user ID
**Fix:** User doesn't exist in public.users. Check Step 5 query to verify.

---

## Success Criteria

✅ All 19 tables exist
✅ FK constraints named correctly
✅ Trigger exists and fires
✅ Registration creates user in both tables
✅ No console errors
✅ Dashboard loads completely
✅ All tabs display content

**If all checkboxes are checked, you're done! 🎉**
