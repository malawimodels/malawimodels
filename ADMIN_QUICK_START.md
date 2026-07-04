# Admin Quick Start

Admin access must be assigned in Supabase, not hardcoded in frontend source.

## Setup

1. Copy [set-admin-role.sql](set-admin-role.sql).
2. Replace `admin@example.com` with the intended owner email before running it.
3. Run the SQL in the Supabase SQL Editor.
4. Run [admin-security-policies.sql](admin-security-policies.sql) only if you still need the legacy email-helper policies; prefer role/admin-permission based RLS for production.

## Security Notes

- Do not put owner emails, service-role keys, Cloudinary API secrets, or private API keys in client source.
- The frontend only hides or shows UI. Supabase RLS is the real access control.
- The public Supabase anon key is expected in the browser; protect data with policies, not by trying to hide the anon key.