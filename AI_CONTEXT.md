# AI Context

Last reviewed: 2026-07-03

This file is a compact, token-efficient project briefing for future AI agents. For exhaustive detail, read `PROJECT_MASTER_DOCUMENTATION.md`.

## Project Summary

Malawi Models is a React/Vite/Supabase marketplace for models, agencies, clients, and admins. It supports model profiles, portfolios, talent discovery, agency recruitment, project/casting calls, project applications, invitations, bookings, rate negotiation, reviews, reports, notifications, and platform administration.

The app is frontend-only. There is no Express/Next API backend. The frontend talks directly to Supabase Auth/Postgres/Realtime and Cloudinary.

## Tech Stack

- React 19 + TypeScript.
- Vite dev/build tool.
- React Router DOM with `HashRouter`.
- Tailwind CSS with custom brand variables.
- Supabase Auth, Postgres, Realtime, and RLS.
- Cloudinary for image upload/storage/CDN transformations.
- Lucide React icons.
- Recharts for dashboard charts.

Commands:

- `npm run dev`: start Vite on port 3000.
- `npm run build`: production build.
- `npm run preview`: preview build.

## Critical Architecture Facts

- `App.tsx` owns routes, `ProtectedRoute`, and `ShortlistContext`.
- `auth/AuthContext.tsx` owns auth/session/role state and admin email override.
- `services/supabase.service.ts` is the central data/service/business layer.
- `supabase.ts` creates the Supabase client from env vars.
- `types.ts` is the central domain model.
- `config/admin.ts` defines the single admin email, currently `mphepobenedict@gmail.com`.
- There is no `public.agencies` table. Agencies are users with `users.role = 'agency'`, plus user profile/gallery/custom-link data and model roster relationships.
- Do not add policies/queries for `public.agencies` unless a real table is created.

## Important Routes

Public:

- `/`: home and talent discovery.
- `/register`: login/signup.
- `/profile/:id`: model profile.
- `/agencies`: agency directory.
- `/agency/:id`: agency profile.
- `/casting`: project/casting creation.
- `/shortlist`: in-memory saved model list.
- `/help`, `/safety`, `/contact`: static/support pages.

Protected:

- `/dashboard`: model dashboard.
- `/client-dashboard`: client dashboard.
- `/agency-dashboard`: agency dashboard.
- `/agency-registration`: model-to-agency registration request.
- `/admin`: admin dashboard, gated by admin role/email.

## User Roles

`UserRole` enum:

- `guest`: unauthenticated visitor.
- `model`: talent user. Can edit profile, upload portfolio, apply to projects, respond to invites, negotiate bookings, join/leave agencies.
- `client`: can search talent, create projects, invite models, approve applications, negotiate and complete bookings.
- `agency`: user role representing an agency. Can configure agency profile, invite/recruit models, review incoming applications, manage roster.
- `admin`: platform moderator. Can manage users, projects, agency requests, reports, warnings, and leave requests.

## Main Workflows

Authentication:

1. `/register` calls Supabase Auth signup/login.
2. Signup metadata includes `display_name` and `role`.
3. `createUserProfile()` upserts `public.users`; model role creates a default `models` row.
4. `AuthContext` loads role from `users`, except admin email is upgraded to admin role locally and synced.
5. Routes redirect by role.

Model profile:

1. Model opens dashboard profile tab.
2. `updateModelProfile()` splits updates across `users`, `models`, `model_categories`, `model_pricing`, and `model_images`.
3. Cloudinary stores uploaded images; DB stores URLs and public IDs.

Project/application:

1. Client creates project with `createProject()`.
2. Client invites model with `inviteModelToProject()` or model applies with `applyToProject()`.
3. Model opportunity UI shows `Requested` after application and supports `cancelProjectApplication()` for pending requests.
4. Client approves with `approveModelApplication()`.
5. Approval creates a booking.

Booking:

1. `bookings` stores current booking state and denormalized parties/project.
2. `booking_negotiations` stores offer history.
3. `updateBookingOffer()` creates negotiation entries and updates current offer fields.
4. `completeBooking()` marks complete; `submitReview()` records ratings.
5. Reports/cancellations/blocking happen from booking action UI.

Agency:

1. Model submits agency registration via `submitAgencyRequest()`.
2. Admin approves/rejects with `approveAgencyRequest()`/`rejectAgencyRequest()`.
3. Approval changes user role to `agency` and sends notification.
4. Agencies invite models with `inviteModelToAgency()`.
5. Models apply with `applyToJoinAgency()`.
6. Responses update `models.agency_id` / `agency_name` and send notifications.

Admin:

1. Admin email/role accesses `/admin`.
2. Admin dashboard tabs call `getAllUsers()`, `getAllProjectsAdmin()`, `subscribeToAgencyRequests()`, `subscribeToReports()`, and leave-request subscriptions.
3. Admin actions include user verification/block/delete, project delete, agency approval/rejection, report review/warning/resolve, leave request processing.

## Database Summary

Core tables:

- `users`: base account/profile and role.
- `models`: model-specific profile.
- `model_images`: portfolio images.
- `model_categories`: model category many-to-many.
- `model_pricing`: category rates.
- `custom_links`: dynamic social/portfolio links.
- `gallery_images`: user/agency gallery images.
- `projects`: casting calls.
- `project_applications`: model applications.
- `project_invitations`: client invitations to models.
- `bookings`: booking lifecycle and current offer.
- `booking_negotiations`: offer history.
- `booking_hidden_by`: per-user archive state.
- `reviews`: ratings/comments.
- `reports`: moderation reports.
- `notifications`: in-app alerts.
- `agency_requests`: requests to become an agency.
- `agency_request_photos`: photos attached to agency request.
- `agency_applications`: models applying to agencies.
- `agency_invitations`: agencies inviting models.
- `leave_requests`: model requests to leave agency.

Key schema files:

- `supabase-schema.sql`: canonical full schema.
- `supabase-agency-fix-migration.sql`: adds missing `tiktok` and `location` columns.
- `set-admin-role.sql`: sets admin role.
- `admin-security-policies.sql`: extra admin policies. Fixed to avoid nonexistent `public.agencies`.

## Service Layer Map

`services/supabase.service.ts` domains:

- User management: profile CRUD, admin verification/block/delete, warnings.
- Model management: model profile fetch/update/search, agency roster, views.
- Agency management: agency requests, applications, invitations, leave requests.
- Project management: project CRUD, applications, invitations, approvals.
- Booking management: realtime booking feeds, offers, statuses, completion, cancellation, archive, payment proof.
- Review/report: submit reviews/reports, admin report queue/status.
- Notifications: create, subscribe, mark read/delete.
- Transforms: database snake_case to frontend camelCase objects.

`services/cloudinary.ts`:

- Client-side unsigned image uploads.
- Batch uploads.
- URL optimization helpers.
- Public ID parsing.
- Client-side compression.
- Deletion needs a backend and must not expose API secret.

`utils/imageOptimizer.ts`:

- Legacy canvas-to-base64 compression.

## Security Model

Security layers:

1. Supabase Auth proves identity.
2. `AuthContext` stores user and role.
3. `ProtectedRoute` gates route access.
4. Component-level conditional rendering hides unauthorized UI.
5. Supabase RLS policies are the real backend enforcement.
6. Admin email is checked by `isAdminEmail()` and SQL helper functions.

Important security caveats:

- Frontend route checks alone are not secure.
- RLS must be enabled and policies must be applied in Supabase.
- Admin is currently a single hardcoded email. This is operationally simple but not ideal for production security.
- Cloudinary unsigned presets must be locked down in Cloudinary settings.
- No custom backend exists for privileged Cloudinary deletion or rate limiting.
- Hard deletes can remove evidence needed for disputes/moderation.

## Known Limitations

- No persistent shortlist/saved list table.
- No full direct messaging/chat system.
- No password reset UI.
- No real payment/escrow integration.
- No contract/agreement generation.
- No audit log for admin actions.
- No multi-admin permission model.
- No advanced analytics dashboard for portfolio performance.
- Some service queries lack pagination.
- Large Vite bundle warning appears during build.
- Cloudinary deletion is not implemented safely client-side.
- Some existing markdown docs are historical and may conflict with current fixes.

## Common Developer Tasks

Admin access:

- Update admin email in `config/admin.ts`.
- Update and run `set-admin-role.sql`.
- Update admin SQL helper/policies to match.
- Rebuild app.

Database setup:

- Run `supabase-schema.sql` first.
- Run profile/agency migrations as needed.
- Run admin role/security SQL.
- Confirm RLS is enabled and policies are not referencing missing tables.

Add a model field:

- Update `types.ts`.
- Update `supabase-schema.sql` or migration.
- Update transform functions in `supabase.service.ts`.
- Update relevant settings/display components.
- Update RLS if permissions change.

Add a new workflow:

- Add schema/migration first.
- Add service functions in `supabase.service.ts`.
- Add typed interfaces/enums in `types.ts`.
- Add page/component UI.
- Add realtime subscription only if live updates are needed.
- Add audit/security documentation.

Debug permission errors:

- Check authenticated user ID and role in `public.users`.
- Check route role guard in `App.tsx`.
- Check RLS policies on the target table.
- Check SQL helper functions like `is_admin()`.
- Check that the table actually exists; there is no `public.agencies` table.

## Build Status Context

Recent `npm run build` completed successfully with Vite. It emitted a bundle-size warning because the minified JS chunk is larger than 500 KB. That warning is not a compilation failure.
