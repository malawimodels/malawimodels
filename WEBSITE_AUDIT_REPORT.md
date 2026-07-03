# Website Audit Report

Last reviewed: 2026-07-03

Scope: full repository review of the React/Vite/Supabase/Cloudinary Malawi Models platform. This audit documents gaps and risks only. It does not implement fixes.

## Audit Summary

The platform already has a strong foundation for a modeling marketplace: multi-role dashboards, profile management, discovery, casting projects, applications, invitations, agency workflows, booking negotiation, reports, notifications, and admin tooling. The biggest production-readiness gaps are security hardening, persistence for saved/favorite workflows, payment/contract systems, admin auditability, pagination/performance, and compliance documentation.

Overall risk posture: medium-high until database RLS is verified live and admin/security policies are production hardened.

## Missing Features

### Marketplace and discovery

1. Persistent saved talent lists
   - Current shortlist is in-memory in `ShortlistContext`.
   - Missing database-backed saved lists per client/user, named lists, notes, sharing, export.
   - Recommendation: add `saved_lists` and `saved_list_items` tables with RLS.

2. Client favorites and team collaboration
   - No persistent favorites, team comments, or client team accounts.
   - Recommendation: support favorite models, internal notes, and team/shared project access.

3. Advanced search filters
   - Current search supports useful basics, but professional casting often needs age ranges, height ranges, availability date, rates, verified only, agency represented, city radius, languages, specialties, experience level, and recent activity.
   - Recommendation: extend filters and add database indexes/FTS.

4. Availability calendar
   - Models have a boolean availability flag, but no calendar.
   - Recommendation: add model availability blocks, booking conflict detection, and client date search.

5. Talent recommendations and AI matching
   - Gemini env support exists, but no implemented matching feature.
   - Recommendation: add rules-first matching, then AI suggestions with clear explanation and opt-out.

6. Portfolio analytics
   - Model views exist, but no detailed analytics.
   - Recommendation: track profile views, search appearances, shortlist saves, application conversion, category performance, and booking conversion over time.

7. Portfolio performance tracking
   - No per-image engagement or A/B media insight.
   - Recommendation: track media view/click order and profile completion impact.

8. Verification badges and levels
   - Users have `verified`, but verification workflow is simple.
   - Recommendation: introduce verification levels: email verified, phone verified, ID verified, agency verified, admin verified.

9. Availability and rate recommendations
   - No suggested rate ranges by category/location/experience.
   - Recommendation: use platform data to recommend model pricing while preserving user control.

### Casting and project management

10. Audition management
    - No audition slots, callbacks, or attendance tracking.
    - Recommendation: add audition sessions, RSVP, waitlist, check-in, and callback stages.

11. Casting pipeline stages
    - Current applications are pending/approved/rejected.
    - Missing shortlist, callback, hold, selected, released, booked.
    - Recommendation: create configurable project pipeline statuses.

12. Project templates
    - Clients must create projects from scratch.
    - Recommendation: add templates for music video, commercial, runway, influencer shoot, casting call.

13. Bulk actions for applicants
    - Admin/client tables have some actions, but no professional bulk workflow.
    - Recommendation: bulk reject, bulk invite, batch message/notify, batch export.

14. Applicant comparison view
    - No side-by-side model comparison for a casting decision.
    - Recommendation: compare profile, rates, location, availability, ratings, media.

15. Talent package generation
    - Clients/agencies cannot export model comp cards or PDF shortlists.
    - Recommendation: generate PDF decks or share links.

### Messaging and communication

16. Full messaging system
    - Notifications and booking negotiations exist, but no persistent direct chat.
    - Recommendation: add conversation threads with participants, messages, attachments, read receipts, moderation flags.

17. Message templates
    - No saved templates for booking offers, casting invites, agency outreach.
    - Recommendation: add templates for common professional workflows.

18. Notification preferences
    - No email/SMS/in-app preference center.
    - Recommendation: user-configurable notification channels and quiet hours.

19. Email notifications
    - In-app notifications exist, but no transactional email integration.
    - Recommendation: Supabase Edge Functions or backend service with Resend/Postmark/SendGrid.

20. WhatsApp deep-link governance
    - Contact fields exist, but no controlled communication workflow.
    - Recommendation: use platform messaging first and track external contact disclosure.

### Payments, contracts, and compliance

21. Escrow payments
    - Payment proof upload exists, but no real payment processor or escrow.
    - Recommendation: integrate a payment provider appropriate for Malawi/mobile money/card rails, then hold funds until completion.

22. Invoices and receipts
    - No invoice generation.
    - Recommendation: generate invoices/receipts for client and model/agency.

23. Digital agreements/contracts
    - No contract generation or e-signature.
    - Recommendation: add project agreement templates, model release forms, cancellation policy, acceptance logs.

24. Platform commission tracking
    - No commission, payout, or revenue ledger.
    - Recommendation: add transaction ledger and payout statuses.

25. Refund/dispute workflow
    - Reports/disputes are basic.
    - Recommendation: create dispute cases tied to bookings, evidence, timelines, and admin decisions.

### Trust, safety, moderation

26. Identity verification workflow
    - No formal ID/KYC verification.
    - Recommendation: add identity verification provider or manual admin workflow.

27. Content moderation for uploads
    - Uploaded images are not moderated.
    - Recommendation: Cloudinary moderation add-ons or queue for admin review.

28. Admin audit logs
    - Admin actions are not logged.
    - Recommendation: add `admin_audit_logs` for action, actor, target, before/after, timestamp, IP/user agent where possible.

29. Abuse prevention/rate limiting
    - No backend rate limiting for signup, applications, uploads, reports, invites.
    - Recommendation: Supabase policies, database constraints, Edge Functions, Cloudinary preset limits.

30. Multi-admin permissions
    - Admin is one hardcoded email.
    - Recommendation: admin users table with roles such as owner, moderator, support, finance, analyst.

31. Admin dashboard analytics
    - Admin dashboard exists but lacks advanced operational analytics.
    - Recommendation: add moderation queue aging, abuse metrics, conversion funnel, active users, revenue.

### Agency-specific features

32. Agency contracts and commission splits
    - Agencies can manage rosters, but no split/payment agreement.
    - Recommendation: store model-agency agreements, commission percentage, effective dates.

33. Agency team accounts
    - Agency user is a single account.
    - Recommendation: multiple agency staff users with permissions.

34. Roster performance analytics
    - Agency overview has basic stats only.
    - Recommendation: booking conversion, profile views, availability, earnings per talent.

35. Talent onboarding checklist
    - No guided onboarding for agency models.
    - Recommendation: checklist for profile completeness, photos, ID verification, rates, availability.

### Reviews and reputation

36. Review system enhancements
    - Reviews exist but need stronger controls.
    - Recommendation: only completed bookings can review, both-side blind review until both submitted, moderation, public/private feedback split.

37. Reputation scoring
    - `ranking_score` exists, but algorithm and transparency are limited.
    - Recommendation: define ranking from completeness, availability, ratings, response time, bookings, verification.

38. Response-time metrics
    - No response time tracking.
    - Recommendation: track invite/application/booking response latency.

### Developer/operational features

39. Automated tests
    - No test framework was found.
    - Recommendation: add unit tests for transforms/services and Playwright tests for critical flows.

40. Error monitoring
    - No Sentry/LogRocket/etc.
    - Recommendation: add frontend error monitoring with PII scrubbing.

41. Release/deployment docs
    - Existing docs are helpful but fragmented.
    - Recommendation: consolidate into deployment checklist and environment matrix.

## Security Weaknesses

| Finding | Severity | Impact | Recommended solution |
|---|---:|---|---|
| RLS must be verified live | Critical | Supabase anon key can access data beyond intended scope if RLS is not enabled or policies are incomplete | Confirm `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for every table; test as guest/model/client/agency/admin |
| Single hardcoded admin email | Critical | Compromise of one email gives full admin access; no rotation/audit or delegation | Implement database-driven admin roles, MFA, audit logs, and emergency recovery admin flow |
| Frontend-only privileged operations | High | Sensitive operations rely entirely on client plus RLS; limited ability to enforce rate limits/business invariants | Move critical admin/payment/storage operations to Supabase Edge Functions or backend |
| No admin audit log | High | Cannot investigate misuse or accidental destructive actions | Add audit log table and write logs for admin user/project/request/report actions |
| Hard deletes for users/bookings/projects | High | Deletes can destroy dispute evidence and audit history | Convert destructive deletes to soft deletes with retention policy |
| Cloudinary unsigned uploads | High | Abuse can consume storage/bandwidth or host inappropriate content | Lock presets to folders, file size/type, moderation; add upload limits and backend-signed uploads for sensitive types |
| No rate limiting | High | Application/report/invite/upload spam; free-tier exhaustion | Add DB constraints, cooldown tables, Edge Function checks, Cloudinary limits |
| Payment proof not strongly validated | Medium | Fake/malicious/inappropriate payment evidence can be uploaded | Validate file type/size, moderation, admin verification status, payment provider integration |
| Text input sanitization relies on React escaping | Medium | Stored text may become risky if later rendered as HTML or exported | Sanitize/validate text fields, length limits, profanity/abuse filters |
| Admin SQL helper duplicates frontend email | Medium | Drift between `config/admin.ts` and SQL policy email can lock out or overgrant access | Store admin allowlist in DB and read from one source |
| Registration role trust | Medium | Signup metadata can request allowed role if not validated | Ensure database trigger validates allowed roles and prevents direct admin/agency role creation |
| Missing password reset UI | Medium | Users cannot recover accounts through app UX | Add reset password flow using Supabase Auth |
| No account deletion evidence retention | Medium | Compliance and dispute evidence gaps | Add deletion request lifecycle, export, anonymization, retention logic |
| Sensitive contact info stored plaintext | Low/Medium | DB exposure reveals WhatsApp/social details | Consider field-level encryption for private contact info and visibility controls |

## Authorization and Role Escalation Risks

- Agency approval changes user role to `agency`; this must remain admin-only in RLS.
- `AuthContext` attempts to update admin role when admin email logs in. This update must be permitted only for the same user/admin path and not generalized.
- If `users` update policy is too broad, users may modify their own `role`. Verify `Users can update own profile` excludes `role` changes or use a trigger to block non-admin role updates.
- Client-side hidden buttons do not prevent direct API calls. All service mutations must be backed by RLS.
- Reports, warnings, blocking, and deletes should all be admin/participant constrained at the database level.

## Data Exposure Risks

- Public model profiles may expose contact details depending UI and RLS.
- `getAllUsers()` and admin subscriptions must be admin-only.
- Denormalized project/bookings store names/photos; stale or deleted-user data may remain visible.
- Notifications may contain sensitive text and links; users should only see own notifications.
- Agency requests include photos/social/contact details; admin-only visibility must be enforced.

## Storage Risks

- Cloudinary image deletion is not safely implemented from frontend because deletion requires API secret.
- Orphaned Cloudinary assets can accumulate after DB delete or upload failure.
- No virus/NSFW moderation layer is documented.
- Payment proofs require stronger controls than ordinary gallery images.

## Performance Weaknesses

| Finding | Severity | Impact | Recommended solution |
|---|---:|---|---|
| Large JS bundle warning | Medium | Slower first load on mobile/low bandwidth | Code split dashboards/admin, lazy-load heavy pages and Recharts |
| Limited pagination | High at scale | Large user/model/project lists become slow and expensive | Add pagination to model search, admin users, projects, bookings, agencies |
| Potential N+1 fetching | Medium | Extra queries for user/model attachment | Use explicit FKs and joined selects where unambiguous |
| Realtime subscriptions refetch full lists | Medium | Bandwidth grows as data grows | Apply incremental updates or limit refetch scope |
| 500ms debounce everywhere | Low/Medium | Saves bandwidth but delays time-sensitive booking updates | Tune by feature; bookings can use lower debounce than admin/project lists |
| Denormalized data can become stale | Medium | Requires extra update queries or stale UI | Add DB triggers or service update fanout for owner/model names/photos |
| No full-text search | Medium | Search quality and query performance may degrade | Add PostgreSQL FTS indexes and search RPC |
| Image transforms are mostly URL based | Low/Medium | Good CDN support, but no guaranteed generated thumbnails | Use Cloudinary named transformations and eager thumbnails for critical media |
| No caching strategy | Medium | Repeated dashboard loads fetch same data | Add query caching or service-level memoization where safe |

## UX/UI Weaknesses

- The `/register` page doubles as login/signup and may be confusing without prominent mode switching and account recovery.
- No password reset page.
- No guided onboarding for model profile completeness beyond form fields.
- Shortlist disappears after refresh because it is in memory.
- Professional casting workflows need clearer applicant pipeline stages.
- Booking negotiation may need clearer state labels, timeline, and next-action prompts.
- Destructive admin actions exist, but admin audit/history is not visible.
- Error messages often use alerts or generic permission errors; users need actionable explanations.
- Some flows depend on SQL migrations being run; app UX may fail with database 400 errors if schema is stale.
- Mobile usability should be screenshot-tested for admin tables, booking cards, gallery modals, and long forms.
- Contact/help/safety pages are useful but need terms/privacy links and legal acknowledgement.
- Agency registration upload requirements may need clearer progress and retry UX.

## Compliance Review

Privacy readiness:

- Current state: partial.
- Gaps: privacy policy, data processing notice, contact visibility controls, user data export, account deletion/anonymization, retention policy.
- Recommendation: add legal pages and user-facing privacy controls.

Terms of Service:

- Current state: not clearly implemented.
- Gaps: client/model obligations, booking cancellation policy, payment terms, content ownership, agency responsibility, prohibited conduct.
- Recommendation: add Terms page and require acceptance at signup.

User consent:

- Current state: signup does not visibly capture terms/privacy consent.
- Gaps: marketing consent, cookie/analytics consent if analytics is added, media/model release consent.
- Recommendation: explicit consent checkboxes and versioned consent records.

Content moderation:

- Current state: reports/admin warnings exist.
- Gaps: image moderation, automated abuse detection, moderation queue for uploaded assets, appeal process.
- Recommendation: add moderation statuses and content review tooling.

User reporting:

- Current state: reports table and admin report UI exist.
- Gaps: evidence attachments, dispute category specificity, status transparency for reporter, SLA tracking.
- Recommendation: turn reports into structured moderation cases.

Data retention:

- Current state: hard delete paths exist.
- Gaps: retention schedule, legal hold for disputes, anonymized historical records.
- Recommendation: soft delete plus retention policy by data category.

Account deletion:

- Current state: admin/user deletion functions and agency leave requests exist.
- Gaps: self-service account deletion request, export before deletion, pending booking handling.
- Recommendation: formal account deletion workflow.

Platform abuse prevention:

- Current state: warnings, reports, block status, `is_active`.
- Gaps: rate limits, bot protection, invite/application spam controls, upload quotas, fraud detection.
- Recommendation: add abuse counters, cooldowns, and automated thresholds.

Payment compliance:

- Current state: no real payment system.
- Gaps: invoicing, tax, escrow, refunds, payout identity verification.
- Recommendation: do not represent as payment-secure until a real provider and compliance process are integrated.

## Priority Recommendations

### Immediate before production

1. Verify all RLS policies are enabled and correct for every table.
2. Prevent users from changing their own `role` unless admin.
3. Replace hard deletes with soft deletes for users/bookings/projects or at least add admin confirmation/audit logs.
4. Lock down Cloudinary upload presets and add size/type/folder restrictions.
5. Add password reset UI.
6. Persist shortlist/favorites.
7. Add pagination to admin/user/model/project lists.
8. Add privacy/terms pages and signup consent.

### Next iteration

1. Build database-backed messaging.
2. Add casting pipeline stages.
3. Add availability calendar.
4. Add contract/agreement flow.
5. Add payment provider/escrow instead of proof-only uploads.
6. Add model/agency/client analytics.
7. Add multi-admin permissions and audit logs.
8. Add automated tests for critical flows.

### Longer-term differentiators

1. AI matching and recommendation engine.
2. Portfolio performance insights.
3. Talent comp-card/deck exports.
4. Agency commission and roster performance tools.
5. Verification/KYC and trust badges.
