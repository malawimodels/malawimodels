# Admin Security

The current admin model should be database-led: authenticated users receive roles from Supabase, and admin-only operations must be protected by RLS policies, admin permission records, or controlled SQL/RPC functions.

## Current Rules

- The React app checks the resolved role from [AuthContext.tsx](auth/AuthContext.tsx).
- The admin route in [App.tsx](App.tsx) allows only users whose role resolves to `admin`.
- Admin data access must be enforced in Supabase policies and functions.
- Public source must not contain real owner emails or private keys.

## Setup

1. Use [set-admin-role.sql](set-admin-role.sql) as a template.
2. Replace `admin@example.com` with the intended owner email before applying it.
3. Use [supabase-production-hardening.sql](supabase-production-hardening.sql) for role/admin permission tables and audit logging foundations.
4. Verify RLS policies in Supabase before going live.

## Production Checklist

- Store admin ownership in database records, not frontend constants.
- Keep Supabase service-role keys server-side only.
- Keep Cloudinary API secrets server-side only.
- Use unsigned Cloudinary upload presets for client uploads, with strict preset restrictions in Cloudinary.
- Keep admin actions auditable through `admin_audit_logs` or an equivalent protected table.
- Treat browser route checks as UI convenience only; never as final authorization.