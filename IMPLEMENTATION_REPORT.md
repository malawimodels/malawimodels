# Implementation Report

## Summary

This implementation hardens Malawi Models for production while preserving Supabase and Cloudflare free-tier resources. The changes focus on database-backed admin security, low-cost marketplace features, safer account flows, persistent saved models, moderation/audit foundations, and improved bundle performance.

## Security Improvements

- Replaced runtime hardcoded-email admin access with database-backed `admin_permissions` checks.
- Added a production hardening SQL migration for admin permissions, audit logs, rate limits, saved models, notification preferences, availability blocks, agreements, disputes, moderation cases, agency team members, onboarding tasks, and platform metrics.
- Added admin audit logging for user verification, user blocking, soft deletion, agency request approval/rejection, report updates, warnings, and project soft deletion.
- Prevented normal profile updates from changing protected fields such as role, verification state, or active status.
- Added soft-delete behavior for destructive user/project actions instead of hard deletion.
- Added server-side rate-limit helper usage for project applications, project invitations, agency invitations, reports, disputes, login attempts, and password reset requests.
- Added Supabase password reset and password recovery handling.

## Marketplace Improvements

- Added persistent saved-model support through the `saved_models` table.
- Updated shortlist behavior so authenticated users save models in Supabase, while guests keep a local browser fallback.
- Replaced shortlist N+1 model loading with one batch model fetch.
- Removed per-card rating lookups from `ModelCard`; cards now use rating data already present on the model payload.
- Expanded search filter types and service logic for age, rate, verified status, agency representation, availability date, and pagination.

## Booking, Agreement, And Dispute Foundations

- Added service APIs for contract templates, booking agreements, disputes, and dispute evidence.
- Added dispute creation rate limiting.
- Kept payment processing out of scope as requested. The current foundation supports proof-of-payment and agreement workflows without implementing escrow, PayChangu, card payments, bank payments, or mobile-money processing.

## Agency Improvements

- Added rate limiting for agency model invitations.
- Added audit logging for agency approval and rejection decisions.
- Preserved the existing agency request flow while moving admin authorization away from client-side email checks.

## Profile And Notification Improvements

- Added model availability block management in model profile settings.
- Added notification preference management in model profile settings.
- Notification creation now respects the user's in-app notification preference.
- Availability and notification settings use one-time fetches and mutations, not realtime subscriptions.

## Performance And Resource Efficiency

- Added route-level lazy loading with `React.lazy` and `Suspense`.
- Added Vite manual chunks for React and Supabase vendor code.
- Production build now completes without chunk-size warnings.
- Entry bundle is much smaller after route splitting and vendor chunking.
- Avoided new polling loops and avoided broad new realtime subscriptions.
- Added query limits for new service reads such as availability blocks, disputes, and dispute evidence.

## Database Migration

Run `supabase-production-hardening.sql` after the current base schema migration. It assumes the existing `users`, `models`, `projects`, `bookings`, and `reports` tables already exist.

Important behavior:

- The only owner admin bootstrapped by SQL is `mphepobenedict@gmail.com`.
- The app checks admin status through `admin_permissions`, not through a client-side email bypass.
- There is no `public.agencies` table; agencies remain users with agency role/profile data.

## Validation

- Type diagnostics passed for touched application files.
- `npm run build` passed successfully.
- Final production build generated route chunks plus `react-vendor` and `supabase` vendor chunks without Vite chunk-size warnings.

## Remaining Recommendations

- Apply `supabase-production-hardening.sql` in Supabase before relying on the new DB-backed features in production.
- Add small admin screens for moderation cases, audit log review, disputes, and contract template management.
- Add UI for booking agreements inside booking detail views.
- Add admin pagination controls for very large user/report/project datasets.
- Add optional proof-of-payment upload review workflow before considering any payment integration.
- Keep escrow, PayChangu, card, bank, and mobile-money processing as a future documented phase only after legal, compliance, reconciliation, and dispute policies are complete.
