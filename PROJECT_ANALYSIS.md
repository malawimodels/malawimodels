# COMPLETE PROJECT ANALYSIS — Malawi Models Platform

**Generated:** 2026-06-29  
**Status:** Development Server Running  
**Platform:** Model casting & talent management for Malawi

---

## EXECUTIVE SUMMARY

**What This Is:**  
A full-stack web application connecting models, agencies, and clients (brands/companies) in Malawi. Functions as a centralized casting platform with booking management, agency representation, and project coordination.

**Tech Stack:**
- Frontend: React 19.2.4, TypeScript, Vite 6.4.3, React Router v7, Tailwind (CDN)
- Backend: Firebase (Auth, Firestore, Analytics)
- State: React Context API
- UI: Lucide React icons, Recharts

**Critical Security Issues Found:**
1. ❌ Firebase production credentials committed to source code ([firebase.ts](firebase.ts))
2. ❌ Admin email typo in Firestore rules: `gmai.com` → should be `gmail.com`
3. ❌ Missing `/index.css` file referenced in [index.html](index.html)

---

## 1. COMPLETE FILE INVENTORY & RESPONSIBILITIES

### Core Configuration
| File | Purpose | Key Details |
|------|---------|-------------|
| [package.json](package.json) | Dependencies & scripts | React 19, Firebase 12, Router 7, dev script: `vite` |
| [vite.config.ts](vite.config.ts) | Build & dev server config | Vite React setup, port 3000, vendor chunking |
| [tsconfig.json](tsconfig.json) | TypeScript compiler | Target ES2022, JSX react-jsx, bundler resolution |
| [.gitignore](.gitignore) | Version control | node_modules, dist, .local files ignored |
| [.firebaserc](.firebaserc) | Firebase project ID | `default: malawimodels` |
| [firestore.rules](firestore.rules) | Database security | Admin check has typo, role-based access |
| [metadata.json](metadata.json) | Project metadata | Name: "11111agency malawimodels" |

### Entry Points
| File | Purpose | Renders |
|------|---------|---------|
| [index.html](index.html) | HTML shell | Tailwind CDN, importmap for esm.sh packages, loads `/index.tsx` |
| [index.tsx](index.tsx) | React mount | `ReactDOM.createRoot` → renders `<App />` |
| [App.tsx](App.tsx) | Router & providers | `BrowserRouter`, `ShortlistContext`, `NotificationProvider`, routes |

### Authentication & State
| File | Exports | Used By |
|------|---------|---------|
| [auth/AuthContext.tsx](auth/AuthContext.tsx) | `AuthProvider`, `useAuth()` | All protected pages |
| [firebase.ts](firebase.ts) | `auth`, `db`, `analytics` | firestore.ts, AuthContext |

### Core Business Logic
| File | Functions | Collections Accessed |
|------|-----------|----------------------|
| [services/firestore.ts](services/firestore.ts) | 60+ functions | users, models, agencies, projects, bookings, reports, notifications, reviews, agencyRequests, agencyApplications, agencyInvites, leaveRequests |
| [services/mockData.ts](services/mockData.ts) | `mockModels`, `mockProjects`, `calculateRanking` | None (demo data) |

### Type Definitions
| File | Exports |
|------|---------|
| [types.ts](types.ts) | UserRole, ProjectStatus, BookingStatus, ReportReason, ModelProfile, Project, Booking, UserData, Review, Report, Notification, AgencyRequest, AgencyApplication, AgencyInvite, LeaveRequest, 20+ enums & interfaces |

### UI Components (Shared)
| Component | Purpose | Key Dependencies |
|-----------|---------|------------------|
| [components/Layout.tsx](components/Layout.tsx) | Top navigation bar | AuthContext, checks admin emails |
| [components/NotificationSystem.tsx](components/NotificationSystem.tsx) | Toast notifications | Context provider for app-wide alerts |
| [components/ModelCard.tsx](components/ModelCard.tsx) | Model listing card | getUserData(), ShortlistContext |
| [components/AgencyCard.tsx](components/AgencyCard.tsx) | Agency display card | Rankings, model count |
| [components/JoinAgencyModal.tsx](components/JoinAgencyModal.tsx) | Model → Agency application | applyToJoinAgency(), agency list |
| [components/BookingActionModal.tsx](components/BookingActionModal.tsx) | Multi-purpose action modal | cancel, report, review, complete, block |
| [components/ConfirmationModal.tsx](components/ConfirmationModal.tsx) | Generic confirmation dialog | Reusable across features |

### Admin Components
| Component | Manages | Firestore Calls |
|-----------|---------|-----------------|
| [components/admin/AdminOverview.tsx](components/admin/AdminOverview.tsx) | Platform stats | Read-only display |
| [components/admin/AdminUsers.tsx](components/admin/AdminUsers.tsx) | User management | toggleVerification, toggleBlock, deleteUser |
| [components/admin/AdminProjects.tsx](components/admin/AdminProjects.tsx) | Project moderation | deleteProject |
| [components/admin/AdminRequests.tsx](components/admin/AdminRequests.tsx) | Agency approval | approveAgencyRequest, rejectAgencyRequest |
| [components/admin/AdminReports.tsx](components/admin/AdminReports.tsx) | Report handling | updateReportStatus, warnUser, blockUser |
| [components/admin/AdminLeaveRequests.tsx](components/admin/AdminLeaveRequests.tsx) | Agency leave approvals | processLeaveRequest |

### Dashboard Components (Model)
| Component | Purpose | Firestore Subscriptions |
|-----------|---------|------------------------|
| [components/dashboard/ModelOverview.tsx](components/dashboard/ModelOverview.tsx) | Stats & agency status | None (receives props) |
| [components/dashboard/ModelOpportunitiesView.tsx](components/dashboard/ModelOpportunitiesView.tsx) | Find work | subscribeToOpenProjectsByCategories, subscribeToProjectInvites |
| [components/dashboard/ModelBookingsView.tsx](components/dashboard/ModelBookingsView.tsx) | Manage bookings | subscribeToBookings (MODEL role) |
| [components/dashboard/ModelProfileSettings.tsx](components/dashboard/ModelProfileSettings.tsx) | Edit profile | None (receives props) |

### Dashboard Components (Agency)
| Component | Purpose | Firestore Subscriptions |
|-----------|---------|------------------------|
| [components/dashboard/AgencyOverview.tsx](components/dashboard/AgencyOverview.tsx) | Agency stats | subscribeToAgencyModels |
| [components/dashboard/AgencyRecruitTalent.tsx](components/dashboard/AgencyRecruitTalent.tsx) | Find & invite models | subscribeToSearchModels, subscribeToAgencyOutgoingInvites |
| [components/dashboard/AgencyModelManagement.tsx](components/dashboard/AgencyModelManagement.tsx) | Manage roster | subscribeToAgencyModels, subscribeToAgencyLeaveRequests |
| [components/dashboard/AgencyApplications.tsx](components/dashboard/AgencyApplications.tsx) | Incoming model apps | subscribeToAgencyIncomingApplications |
| [components/dashboard/AgencyProfileSettings.tsx](components/dashboard/AgencyProfileSettings.tsx) | Edit agency profile | None (receives props) |

### Dashboard Components (Client)
| Component | Purpose | Firestore Subscriptions |
|-----------|---------|------------------------|
| [components/dashboard/ClientOverview.tsx](components/dashboard/ClientOverview.tsx) | Client stats | subscribeToBookings (CLIENT role) |
| [components/dashboard/ClientProjectsView.tsx](components/dashboard/ClientProjectsView.tsx) | Manage casting calls | subscribeToClientProjects |
| [components/dashboard/ClientBookingsView.tsx](components/dashboard/ClientBookingsView.tsx) | Manage bookings | subscribeToBookings (CLIENT role) |
| [components/dashboard/ClientProfileSettings.tsx](components/dashboard/ClientProfileSettings.tsx) | Edit client profile | None (receives props) |

### Pages
| Page | Route | Role Access | Key Features |
|------|-------|-------------|--------------|
| [pages/Home.tsx](pages/Home.tsx) | `/` | Public | Landing page, hero, featured models/projects |
| [pages/Agencies.tsx](pages/Agencies.tsx) | `/agencies` | Public | Agency directory with rankings |
| [pages/CastingCall.tsx](pages/CastingCall.tsx) | `/casting` | Protected (client) | Create new project |
| [pages/Register.tsx](pages/Register.tsx) | `/register` | Auth required | Model registration form |
| [pages/Profile.tsx](pages/Profile.tsx) | `/profile/:uid` | Public | View any user profile |
| [pages/AgencyProfile.tsx](pages/AgencyProfile.tsx) | `/agency/:uid` | Public | View agency details |
| [pages/AgencyRegistration.tsx](pages/AgencyRegistration.tsx) | `/agency-registration` | Protected (model) | Submit agency request |
| [pages/Dashboard.tsx](pages/Dashboard.tsx) | `/dashboard` | Protected (model) | Model dashboard tabs |
| [pages/AgencyDashboard.tsx](pages/AgencyDashboard.tsx) | `/agency-dashboard` | Protected (agency) | Agency dashboard tabs |
| [pages/ClientDashboard.tsx](pages/ClientDashboard.tsx) | `/client-dashboard` | Protected (client) | Client dashboard tabs |
| [pages/Admin.tsx](pages/Admin.tsx) | `/admin` | Protected (admin) | Admin panel tabs |
| [pages/Shortlist.tsx](pages/Shortlist.tsx) | `/shortlist` | Public | View shortlisted models |
| [pages/HelpCenter.tsx](pages/HelpCenter.tsx) | `/help` | Public | FAQ accordion |
| [pages/SafetyTrust.tsx](pages/SafetyTrust.tsx) | `/safety` | Public | Platform safety guidelines |
| [pages/Contact.tsx](pages/Contact.tsx) | `/contact` | Public | Contact form |

### Utilities
| File | Exports | Used By |
|------|---------|---------|
| [utils/imageOptimizer.ts](utils/imageOptimizer.ts) | `compressImageToBase64()` | Profile uploads, registration |

---

## 2. COMPLETE DEPENDENCY GRAPH

### Key Service Functions & Their Callers

#### `services/firestore.ts` Functions

**User Management:**
- `createUserProfile(uid, data)` → Called by: Register.tsx
- `getUserProfile(uid)` → Called by: Profile.tsx, AuthContext
- `getUserData(uid)` → Called by: ModelCard, AgencyCard, Admin pages
- `getUserRole(uid)` → Called by: AuthContext.fetchRole()
- `updateUserProfile(uid, updates)` → Called by: All ProfileSettings components
- `toggleVerification(uid)` → Called by: AdminUsers
- `toggleUserBlock(uid)` → Called by: AdminUsers
- `deleteUser(uid, role)` → Called by: AdminUsers

**Model Operations:**
- `getModelProfile(uid)` → Called by: Profile.tsx, Dashboard, ClientProjectsView (ApplicantRow)
- `subscribeToSearchModels(filters, callback)` → Called by: Home, Agencies, AgencyRecruitTalent
- `subscribeToAgencyModels(agencyId, callback)` → Called by: AgencyOverview, AgencyModelManagement
- `removeModelFromAgency(modelUid)` → Called by: AgencyModelManagement

**Agency Operations:**
- `getAgencies()` → Called by: JoinAgencyModal, AgencyRecruitTalent
- `submitAgencyRequest(requestData)` → Called by: AgencyRegistration
- `approveAgencyRequest(request)` → Called by: AdminRequests
- `rejectAgencyRequest(id)` → Called by: AdminRequests
- `applyToJoinAgency(modelUid, agencyId, note)` → Called by: JoinAgencyModal
- `respondToAgencyApplication(id, accept, agencyId, modelUid, agencyName)` → Called by: AgencyApplications
- `inviteModelToAgency(agencyId, agencyName, modelUid)` → Called by: AgencyRecruitTalent
- `submitLeaveRequest(data)` → Called by: ModelOverview
- `processLeaveRequest(id, approved, modelUid)` → Called by: AdminLeaveRequests
- `subscribeToAgencyRequests(callback)` → Called by: Admin
- `subscribeToAgencyIncomingApplications(agencyId, callback)` → Called by: AgencyApplications
- `subscribeToAgencyOutgoingInvites(agencyId, callback)` → Called by: AgencyRecruitTalent
- `subscribeToAgencyLeaveRequests(agencyId, callback)` → Called by: AgencyModelManagement
- `subscribeToAdminLeaveRequests(callback)` → Called by: AdminLeaveRequests

**Project Operations:**
- `createProject(data)` → Called by: CastingCall
- `subscribeToProjects(callback)` → Called by: Home, AdminProjects
- `subscribeToClientProjects(clientId, callback)` → Called by: ClientProjectsView
- `subscribeToOpenProjectsByCategories(categories, callback)` → Called by: ModelOpportunitiesView
- `subscribeToProjectInvites(modelUid, callback)` → Called by: ModelOpportunitiesView
- `updateProject(id, updates)` → Called by: ClientProjectsView
- `updateProjectStatus(id, updates)` → Called by: ClientProjectsView
- `deleteProject(id)` → Called by: AdminProjects, ClientProjectsView
- `applyToProject(projectId, modelUid)` → Called by: ModelOpportunitiesView
- `declineProjectInvite(projectId, modelUid)` → Called by: ModelOpportunitiesView
- `approveModelApplication(projectId, modelUid, approvals, offerPrice)` → Called by: ClientProjectsView

**Booking Operations:**
- `subscribeToBookings(uid, role, callback)` → Called by: ClientOverview, ModelBookingsView, ClientBookingsView
- `updateBookingStatus(id, status, amount, role)` → Called by: Bookings views
- `updateBookingOffer(id, offer)` → Called by: Bookings views
- `acceptPreviousOffer(id, role)` → (Not directly called in current code)
- `cancelBookingWithReason(id, reason, userId)` → Called by: BookingActionModal handler
- `completeBooking(id)` → Called by: ClientBookingsView
- `archiveBooking(id, userId)` → Called by: Bookings views
- `uploadPaymentProof(id, imageBase64)` → Called by: ClientBookingsView
- `deleteBooking(id)` → Called by: ModelBookingsView
- `blockBookingUser(bookingId, blockerId, blockedId)` → (Defined but not yet called)

**Review & Report Operations:**
- `submitReview(bookingId, reviewData, role)` → Called by: BookingActionModal handler
- `submitReport(reportData)` → Called by: BookingActionModal (report case)
- `subscribeToReports(callback)` → Called by: AdminReports
- `updateReportStatus(id, status)` → Called by: AdminReports
- `warnUser(userId, reportId)` → Called by: AdminReports

**Notification Operations:**
- `subscribeToNotifications(uid, callback)` → Called by: Layout.tsx
- `markNotificationRead(uid, notificationId)` → Called by: Layout.tsx

**Client Stats:**
- `getClientPublicStats(clientId)` → Called by: ClientOverview

---

## 3. DATA FLOW ARCHITECTURE

### Firestore Collections Structure

```
users/ (collection)
├── {uid} (document)
    ├── email, displayName, role, verified, isActive
    ├── photoUrl, bio, gallery[], contact{}, customLinks[]
    ├── stats: {averageRating, reviewsCount, totalProjects, completedProjects, totalHired}
    ├── warningCount, deletionCount, createdAt, updatedAt

models/ (collection)
├── {uid} (document)
    ├── All UserData fields +
    ├── height, gender, skinTone, categories[], location
    ├── agencyId, agencyName, availability
    ├── media: {images[], videos[]}
    ├── pricing: {Category: number}
    ├── views, stats: {history[]}

projects/ (collection)
├── {id} (document)
    ├── title, description, category, location, dates
    ├── ownerId, ownerName, ownerPhotoUrl, ownerVerified
    ├── status (OPEN | COMPLETED)
    ├── applicantModels[], invitedModels[], approvedModels[], approvals[]
    ├── createdAt, updatedAt

bookings/ (collection)
├── {id} (document)
    ├── projectId, projectTitle
    ├── modelId, modelName, clientId, clientName
    ├── status (negotiating | scheduled | completed | cancelled)
    ├── currentOffer, history[] (offer negotiations)
    ├── paymentProofUrl, modelReviewId, clientReviewId
    ├── hiddenBy[] (for archiving)
    ├── createdAt, updatedAt

reviews/ (collection)
├── {id} (document)
    ├── bookingId, authorId, targetId, targetRole
    ├── rating (1-5), comment
    ├── createdAt

reports/ (collection)
├── {id} (document)
    ├── reporterId, reporterRole, reportedUserId, reportedUserRole
    ├── reason, details
    ├── status (PENDING | REVIEWED | RESOLVED)
    ├── createdAt, resolvedAt

notifications/ (collection)
├── {uid} (document, per user)
    ├── items[] (array of notification objects)
        ├── id, type, title, message, read, timestamp, link

agencyRequests/ (collection)
├── {id} (document)
    ├── applicantId, applicantName, agencyName, logoUrl
    ├── bio, whatsapp, socialLinks{}, memberCount{}
    ├── modelPhotos[], status (pending | approved | rejected)
    ├── createdAt

agencyApplications/ (collection)
├── {id} (document)
    ├── modelUid, modelName, modelPhoto, agencyId, note
    ├── status (pending | accepted | rejected)
    ├── createdAt

agencyInvites/ (collection)
├── {id} (document)
    ├── agencyId, agencyName, modelUid
    ├── status (pending | accepted | rejected)
    ├── createdAt

leaveRequests/ (collection)
├── {id} (document)
    ├── modelUid, modelName, agencyId, agencyName, reason
    ├── status (pending | approved | rejected)
    ├── createdAt, processedAt
```

### Authentication Flow

```
1. User visits app
   ↓
2. AuthContext.tsx mounts
   ↓
3. onAuthStateChanged(auth, callback) → Firebase listener
   ↓
4. If user authenticated:
   a. Fetch role: getUserRole(uid) → firestore.ts
   b. Set context: { user, role, loading: false }
   ↓
5. Components consume via useAuth()
   ↓
6. ProtectedRoute in App.tsx checks role & redirects if needed
```

### Booking Lifecycle Flow

```
1. CLIENT creates Project (CastingCall.tsx)
   ↓ createProject()
   ↓ projects/ collection

2. MODEL applies (ModelOpportunitiesView)
   ↓ applyToProject(projectId, modelUid)
   ↓ Adds modelUid to project.applicantModels[]

3. CLIENT approves (ClientProjectsView)
   ↓ approveModelApplication(projectId, modelUid, offerPrice)
   ↓ Creates Booking document with status='negotiating'
   ↓ Removes from applicantModels, adds to approvedModels

4. Negotiation (ModelBookingsView ↔ ClientBookingsView)
   ↓ updateBookingOffer(bookingId, {role, amount, note})
   ↓ Adds entry to booking.history[]
   ↓ Updates booking.currentOffer

5. Acceptance (Either party)
   ↓ updateBookingStatus(bookingId, 'scheduled', amount, role)
   ↓ Booking status → 'scheduled'

6. Completion (CLIENT marks complete)
   ↓ completeBooking(bookingId)
   ↓ Booking status → 'completed'

7. Review (Both parties can review)
   ↓ submitReview(bookingId, reviewData, role)
   ↓ Creates review/ document
   ↓ Updates booking.modelReviewId or booking.clientReviewId
   ↓ Updates target user's averageRating in users/ collection
```

### Agency Relationship Flow

```
Path A: Model applies to Agency
1. MODEL submits application (JoinAgencyModal)
   ↓ applyToJoinAgency(modelUid, agencyId, note)
   ↓ Creates agencyApplications/ document

2. AGENCY reviews (AgencyApplications)
   ↓ respondToAgencyApplication(id, accept=true, agencyId, modelUid, agencyName)
   ↓ Updates model document: agencyId, agencyName
   ↓ Deletes application document

Path B: Agency invites Model
1. AGENCY sends invite (AgencyRecruitTalent)
   ↓ inviteModelToAgency(agencyId, agencyName, modelUid)
   ↓ Creates agencyInvites/ document

2. MODEL accepts (Future feature - UI not fully implemented)
   ↓ Should call respondToAgencyInvite()
   ↓ Updates model document: agencyId, agencyName

Path C: Model leaves Agency
1. MODEL requests leave (ModelOverview)
   ↓ submitLeaveRequest({modelUid, agencyId, reason})
   ↓ Creates leaveRequests/ document

2. ADMIN approves (AdminLeaveRequests)
   ↓ processLeaveRequest(id, approved=true, modelUid)
   ↓ Clears model.agencyId and model.agencyName
   ↓ Updates leaveRequest status
```

---

## 4. ROUTE PROTECTION & AUTHORIZATION

### Public Routes
- `/` (Home)
- `/agencies` (Agencies)
- `/profile/:uid` (Profile)
- `/agency/:uid` (AgencyProfile)
- `/shortlist` (Shortlist)
- `/help` (HelpCenter)
- `/safety` (SafetyTrust)
- `/contact` (Contact)

### Protected Routes (Requires Auth)
- `/register` → Any authenticated user → redirects to role-specific dashboard if already registered
- `/dashboard` → role === 'model'
- `/agency-dashboard` → role === 'agency'
- `/client-dashboard` → role === 'client'
- `/casting` → role === 'client'
- `/agency-registration` → role === 'model' (to become agency owner)
- `/admin` → role === 'admin' from Supabase user role/RLS-backed permissions

### Authorization Checks

**Admin Check:**
Admin access should resolve from Supabase role/admin permission records, not a frontend email array.

**Firestore Rules Admin Check:**
```javascript
function isAdmin() {
  return request.auth.token.email == 'drblessed05@gmail.com' ||
         request.auth.token.email == 'blesse3344@gmai.com'; // ❌ TYPO HERE
}
```

---

## 5. FEATURE COMPLETENESS ANALYSIS

### ✅ Fully Implemented Features

1. **User Registration & Authentication**
   - Firebase email/password auth
   - Role selection (model/client)
   - Profile creation with image compression
   - Role-based dashboard routing

2. **Model Profiles**
   - Full profile with measurements, categories, location
   - Image portfolio (6 images max)
   - Video reel (YouTube URL)
   - Social media links
   - Pricing by category
   - Availability toggle
   - Profile views tracking

3. **Agency Management**
   - Agency registration approval workflow
   - Model roster management
   - Recruitment & invitations
   - Incoming applications handling
   - Leave request system (Admin-approved)

4. **Project/Casting Calls**
   - Create projects with details
   - Application system
   - Applicant management
   - Project status (OPEN/COMPLETED)
   - Direct model invitations

5. **Booking & Negotiation**
   - Offer/counter-offer negotiation flow
   - Booking status lifecycle
   - Payment proof upload
   - Booking archiving

6. **Review System**
   - Rating (1-5 stars)
   - Comment reviews
   - Bidirectional (model ↔ client)
   - Average rating calculation
   - Review count tracking

7. **Admin Panel**
   - User management (verify, block, delete)
   - Project moderation
   - Agency request approval
   - Report handling
   - Leave request approval
   - Platform stats overview

8. **Notifications**
   - Real-time notification system
   - Toast notifications (success/error/info)
   - Persistent notification center

9. **Search & Discovery**
   - Model search with filters (category, location, gender, height, skin tone, availability)
   - Agency directory with rankings
   - Project discovery by model categories

### ⚠️ Partially Implemented

1. **Model accepting Agency Invites**
   - Invite creation exists (AgencyRecruitTalent)
   - Subscription to view invites exists (subscribeToAgencyOutgoingInvites)
   - ❌ No UI for model to view/respond to invites in ModelDashboard
   - ❌ respondToAgencyInvite function defined but not called anywhere

2. **Client Payment Tracking**
   - Payment proof upload exists
   - ❌ No payment amount tracking
   - ❌ No payment status (paid/unpaid)
   - ❌ No invoice generation

3. **Messaging/Chat**
   - ❌ No direct messaging between users
   - Only offer negotiation "chat" in bookings

4. **Email Notifications**
   - ❌ No email notifications
   - Only in-app notifications

### ❌ Missing/Incomplete Features

1. **Advanced Search**
   - No saved searches
   - No search history
   - No "similar models" recommendations

2. **Calendar Integration**
   - No booking calendar view
   - No date conflict checking
   - No Google Calendar sync

3. **Analytics Dashboard**
   - Basic stats only
   - No earnings charts
   - No traffic analytics
   - No conversion metrics

4. **Portfolio Galleries**
   - Limited to 6 images
   - No albums/collections
   - No categorization of media

5. **Contract Management**
   - No PDF contract generation
   - No e-signatures
   - No contract templates

6. **Multi-currency**
   - Only MWK (Malawi Kwacha)
   - No currency conversion

7. **Mobile App**
   - Web-only (responsive design exists)

---

## 6. CODE QUALITY ANALYSIS

### ✅ Strengths

1. **TypeScript Coverage**
   - All files properly typed
   - Comprehensive type definitions in types.ts
   - Proper enum usage

2. **Component Organization**
   - Clear folder structure (pages, components, dashboard, admin)
   - Separation of concerns
   - Reusable modal components

3. **State Management**
   - React Context for auth (centralized)
   - Real-time subscriptions (Firestore onSnapshot)
   - Proper cleanup (useEffect return functions)

4. **UI/UX Patterns**
   - Consistent design language
   - Loading states
   - Error handling with notifications
   - Confirmation modals for destructive actions

5. **Image Optimization**
   - Custom compression utility (compressImageToBase64)
   - Target: 700KB max
   - Canvas-based resizing

### ❌ Issues & Technical Debt

#### Critical Security Issues

1. **Hardcoded Firebase Credentials** ([firebase.ts](firebase.ts))
   ```typescript
   const firebaseConfig = {
     apiKey: "AIzaSyBW8H...",  // ❌ EXPOSED
     authDomain: "malawimodels.firebaseapp.com",
     projectId: "malawimodels",  // ❌ PRODUCTION PROJECT
     storageBucket: "malawimodels.appspot.com",
     messagingSenderId: "906398...",
     appId: "1:9063..."
   };
   ```
   **Impact:** API key exposed in client code → must be rotated
   **Fix:** Move to environment variables, rotate keys

2. **Admin Email Typo** ([firestore.rules](firestore.rules) & [Layout.tsx](components/Layout.tsx))
   ```javascript
   'blesse3344@gmai.com'  // ❌ Should be @gmail.com
   ```
   **Impact:** Admin user cannot access admin panel
   **Fix:** Correct typo in both files

3. **Missing File Reference** ([index.html](index.html))
   ```html
   <link rel="stylesheet" href="/index.css" />  <!-- ❌ File does not exist -->
   ```
   **Impact:** Potential console 404 error
   **Fix:** Either create file or remove reference

#### Architectural Issues

1. **Duplicate Dependency Loading**
   - [index.html](index.html) has importmap for CDN packages (React, React-DOM)
   - [package.json](package.json) also includes React in node_modules
   - **Risk:** Version conflicts, larger bundles
   - **Fix:** Choose one approach (prefer Vite bundling)

2. **Large Service File**
   - [services/firestore.ts](services/firestore.ts): 60+ functions in one file
   - **Impact:** Hard to maintain, test, and navigate
   - **Fix:** Split into domain-specific modules (users.service.ts, projects.service.ts, bookings.service.ts, etc.)

3. **No Error Boundaries**
   - No React Error Boundaries in component tree
   - **Impact:** Unhandled errors crash entire app
   - **Fix:** Wrap major sections in ErrorBoundary components

4. **No Loading Skeletons**
   - Simple "Loading..." text used everywhere
   - **Impact:** Poor perceived performance
   - **Fix:** Add skeleton screens for better UX

5. **No Pagination**
   - All queries fetch entire collections
   - **Impact:** Performance degrades as data grows
   - **Fix:** Implement Firestore pagination (startAfter, limit)

#### Data Validation Issues

1. **Weak Input Validation**
   - Most forms only check `required` fields
   - No email format validation
   - No phone number format validation
   - **Fix:** Add validation library (e.g., Zod, Yup)

2. **No Rate Limiting**
   - No client-side or Firestore rules rate limiting
   - **Risk:** Spam bookings, applications, reports
   - **Fix:** Implement Firestore security rules quotas

3. **No Image MIME Type Check**
   - imageOptimizer accepts any file
   - **Risk:** User uploads non-image files
   - **Fix:** Check `file.type` before processing

#### Performance Issues

1. **Inefficient Subscriptions**
   - Many components subscribe to entire collections
   - Example: AdminUsers fetches ALL users
   - **Fix:** Add pagination, virtual scrolling

2. **No Memoization**
   - Expensive calculations re-run on every render
   - Example: `calculateRanking()` in mockData.ts
   - **Fix:** Use `useMemo` for derived state

3. **Base64 Image Storage**
   - All images stored as Base64 in Firestore documents
   - **Impact:** Large document sizes, quota usage
   - **Fix:** Use Firebase Storage, store URLs only

4. **No Caching Strategy**
   - Every profile view fetches fresh data
   - **Fix:** Implement client-side cache (React Query, SWR)

#### Maintainability Issues

1. **Magic Strings**
   - Collection names hardcoded everywhere
   - Example: `collection(db, 'models')`
   - **Fix:** Create constants file

2. **Inconsistent Naming**
   - Some functions use `subscribe*`, others use `get*`
   - Some components use `View` suffix, others don't
   - **Fix:** Establish naming conventions

3. **Missing Comments**
   - Complex business logic lacks documentation
   - No JSDoc comments on functions
   - **Fix:** Add function documentation

4. **No Unit Tests**
   - Zero test files
   - **Risk:** Regressions on changes
   - **Fix:** Add Jest/Vitest, start with service functions

5. **No E2E Tests**
   - No Playwright/Cypress tests
   - **Risk:** Critical workflows can break
   - **Fix:** Add E2E tests for main user journeys

#### UI/UX Issues

1. **Mobile Responsiveness**
   - Some tables don't scroll well on mobile
   - **Fix:** Use cards on mobile instead of tables

2. **Accessibility**
   - No ARIA labels
   - No keyboard navigation consideration
   - **Fix:** Add semantic HTML, ARIA attributes, focus management

3. **No Offline Support**
   - App breaks completely without internet
   - **Fix:** Implement Service Worker, offline UI

---

## 7. DEPENDENCY VERSIONS & SECURITY

### Current Versions (from package.json)
```json
{
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "react-router-dom": "^7.13.0",
  "firebase": "^12.8.0",
  "typescript": "~5.8.2",
  "vite": "^6.4.3",
  "lucide-react": "^0.469.0",
  "recharts": "^2.15.0"
}
```

### Security Audit Results
```
npm audit
196 packages audited
0 vulnerabilities found  ✅
```

### Update Recommendations
- All packages are relatively current
- React 19 is latest major version
- Firebase SDK v12 is current
- No immediate updates required

---

## 8. ENVIRONMENT & CONFIGURATION

### Required Environment Variables
**Missing `.env.local` file!**

Expected variables:
```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon public key>
VITE_CLOUDINARY_CLOUD_NAME=<your Cloudinary cloud name>
VITE_CLOUDINARY_UPLOAD_PRESET_PROFILE=<unsigned profile preset>
VITE_CLOUDINARY_UPLOAD_PRESET_GALLERY=<unsigned gallery preset>
VITE_CLOUDINARY_UPLOAD_PRESET_PAYMENT=<unsigned payment preset>
```

Do not add Cloudinary API secrets, Supabase service-role keys, or other private keys to Vite environment variables.

**Note:** Firebase config should also be moved to env vars:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Build Configuration
- **Dev Server:** `npm run dev` → Vite on port 3000
- **Build:** `npm run build` → TypeScript check + Vite build → `/dist`
- **Preview:** `npm run preview` → Serve production build locally

---

## 9. FIRESTORE SECURITY RULES ANALYSIS

### Current Rules Summary
```javascript
// ✅ Good: Admin function exists
function isAdmin() { /* ... */ }

// ✅ Good: Authenticated check
function isAuthenticated() { /* ... */ }

// ✅ Good: Owner checks
function isOwner(userId) { /* ... */ }

// ⚠️ Issue: Some collections too open
match /users/{userId} {
  allow read: if true;  // ❌ Anyone can read any user
}

// ✅ Good: Proper model protection
match /models/{modelId} {
  allow read: if true;
  allow write: if isOwner(modelId) || isAdmin();
}

// ⚠️ Issue: Projects write too permissive
match /projects/{projectId} {
  allow read: if true;
  allow write: if isAuthenticated();  // ❌ Any auth user can modify any project
}
```

### Security Recommendations
1. Restrict user profile reads to authenticated users only
2. Add role checks to project writes (only owner or admin)
3. Add rate limiting rules
4. Add data validation rules (e.g., enum validation for status fields)

---

## 10. CRITICAL ACTION ITEMS

### Priority 1: Security (DO IMMEDIATELY)

1. **Rotate Firebase API Keys**
   - Create new Firebase web app
   - Update credentials
   - Add to `.env.local`
   - Update [firebase.ts](firebase.ts) to use `import.meta.env.VITE_FIREBASE_*`
   - Add `.env.local` to `.gitignore` (already there ✅)

2. **Verify Admin Role Security**
   - Ensure admin access is assigned through Supabase role/admin permission records.
   - Ensure RLS blocks non-admin users from admin tables and actions.

3. **Resolve Missing CSS File**
   - Either create `/index.css` or remove `<link>` from [index.html](index.html)

### Priority 2: Functionality (DO NEXT)

1. **Implement Missing Agency Invite Accept Flow**
   - Add UI in ModelDashboard to show pending invites
   - Wire up `respondToAgencyInvite()` call

2. **Add Input Validation**
   - Email format validation
   - Phone number format validation
   - Image file type checking

3. **Split Large Service File**
   - Break [services/firestore.ts](services/firestore.ts) into modules

### Priority 3: Performance (MEDIUM TERM)

1. **Implement Pagination**
   - Admin user lists
   - Model search results
   - Project lists

2. **Migrate to Firebase Storage**
   - Replace Base64 image storage
   - Store file URLs in Firestore instead

3. **Add React Query or SWR**
   - Cache frequently accessed data
   - Reduce redundant Firestore reads

### Priority 4: Quality (LONG TERM)

1. **Add Tests**
   - Unit tests for service functions
   - E2E tests for critical flows

2. **Improve Accessibility**
   - Add ARIA labels
   - Keyboard navigation
   - Screen reader support

3. **Add Error Boundaries**
   - Wrap major sections
   - Graceful error handling

---

## 11. USER JOURNEY MAPS

### Model Registration Journey
```
1. User creates Firebase account (email/password)
   ↓
2. /register → ModelRegistrationForm
   ↓ Fill details: name, location, height, gender, categories
   ↓ Upload photos (compressed to <700KB)
   ↓
3. createUserProfile() + separate model document
   ↓
4. Redirect to /dashboard
   ↓
5. Can now:
   - View opportunities (/dashboard → Opportunities tab)
   - Apply to projects
   - Edit profile
   - Apply to agencies
```

### Client Booking Journey
```
1. Client creates account (email/password)
   ↓
2. /register → Select "Client" role
   ↓
3. /casting → Create project
   ↓ createProject()
   ↓
4. Models apply via ModelOpportunitiesView
   ↓ applyToProject()
   ↓
5. Client reviews applicants in /client-dashboard → Projects tab
   ↓ approveModelApplication(modelId, offerPrice)
   ↓ Creates Booking with status='negotiating'
   ↓
6. Negotiation in /client-dashboard → Bookings tab
   ↓ Client & Model exchange counter-offers
   ↓ updateBookingOffer()
   ↓
7. One party accepts
   ↓ updateBookingStatus(bookingId, 'scheduled')
   ↓
8. Work is performed (offline)
   ↓
9. Client marks complete
   ↓ completeBooking(bookingId)
   ↓
10. Both parties leave reviews
    ↓ submitReview()
    ↓
11. Ratings update on profiles
```

### Agency Recruitment Journey
```
Path A: Model applies to Agency
1. Model visits /agencies
   ↓
2. Finds agency, clicks "Apply"
   ↓ JoinAgencyModal opens
   ↓ applyToJoinAgency(modelUid, agencyId, note)
   ↓ Creates agencyApplications/ document
   ↓
3. Agency sees application in /agency-dashboard → Inbox tab
   ↓ AgencyApplications component
   ↓
4. Agency clicks "Accept"
   ↓ respondToAgencyApplication(id, accept=true)
   ↓ Updates model.agencyId, model.agencyName
   ↓
5. Model now appears in agency roster
   ↓ subscribeToAgencyModels() includes them

Path B: Agency invites Model
1. Agency visits /agency-dashboard → Recruit tab
   ↓ AgencyRecruitTalent component
   ↓ Sees list of independent models
   ↓
2. Agency clicks "Invite" button
   ↓ inviteModelToAgency(agencyId, agencyName, modelUid)
   ↓ Creates agencyInvites/ document
   ↓
3. [MISSING UI] Model should see invite in dashboard
   ↓ [TODO] respondToAgencyInvite() should be called
   ↓
4. If accepted, model.agencyId updated
```

---

## 12. API INTEGRATION POINTS

### Firebase Services Used
1. **Firebase Authentication**
   - Email/Password provider
   - onAuthStateChanged listener
   - signOut()

2. **Cloud Firestore**
   - Real-time listeners (onSnapshot)
   - Batch writes (potential future use)
   - Queries with filters (where, orderBy)

3. **Firebase Analytics**
   - Basic event tracking (initialized but minimal usage)

### External APIs Referenced
1. **YouTube**
   - Model video reels stored as YouTube URLs
   - No API calls, just embedded links

3. **WhatsApp**
   - Contact links (`https://wa.me/...`)
   - No API integration, just deep links

### CDN Dependencies (from index.html importmap)
```javascript
{
  "imports": {
    "react": "https://esm.sh/react@19.2.4",
    "react-dom": "https://esm.sh/react-dom@19.2.4"
  }
}
```
**Issue:** Conflicts with local node_modules
**Recommendation:** Remove importmap, use Vite bundling

---

## 13. DEPLOYMENT READINESS

### ✅ Ready
- [x] Firebase project configured
- [x] Production build command exists
- [x] Environment variable support (vite.config)

### ❌ Not Ready
- [ ] Environment variables not set (missing .env.local)
- [ ] Firebase credentials in source code
- [ ] No CI/CD configuration
- [ ] No deployment documentation
- [ ] No database backup strategy
- [ ] No monitoring/logging setup
- [ ] No performance budgets
- [ ] No error tracking (e.g., Sentry)

### Deployment Checklist
```markdown
- [ ] Create .env.local with all secrets
- [ ] Remove hardcoded Firebase config from firebase.ts
- [ ] Rotate Firebase API keys
- [ ] Fix admin email typo
- [ ] Set up Firebase Hosting or Vercel
- [ ] Configure production Firestore rules
- [ ] Set up database indexes for queries
- [ ] Add error tracking (Sentry/LogRocket)
- [ ] Set up monitoring (Firebase Performance)
- [ ] Create backup strategy (Firestore exports)
- [ ] Document deployment process
- [ ] Set up staging environment
- [ ] Test production build locally
```

---

## 14. RECOMMENDATIONS FOR NEXT CHANGES

### When Implementing New Features

**BEFORE writing code:**
1. Check [services/firestore.ts](services/firestore.ts) for existing functions
2. Verify if collection already exists in types.ts
3. Check if similar component exists in components/
4. Consider impact on Firestore security rules
5. Check if notification should be triggered

**Code Change Checklist:**
- [ ] Update types.ts if adding new data structure
- [ ] Add/update Firestore function in services/
- [ ] Update firestore.rules if new collection/security change
- [ ] Add UI component
- [ ] Add to appropriate dashboard
- [ ] Add notification if user-facing action
- [ ] Consider mobile responsiveness
- [ ] Add loading/error states
- [ ] Update this PROJECT_ANALYSIS.md

### Safe Refactoring Targets
1. Split firestore.ts → Start with user-related functions
2. Keep admin ownership out of frontend constants
3. Convert CSS class strings to const objects
4. Add PropTypes or zod validation to components

---

## CONCLUSION

This is a **well-structured, feature-rich application** with a clear domain model and solid React/TypeScript foundation. The main risks are:

1. **Security:** Exposed credentials and admin access issues
2. **Scalability:** No pagination, inefficient queries, Base64 images
3. **Maintainability:** Large service file, missing tests, minimal documentation

**Before any new features:** Fix Priority 1 security issues.

**Architecture is sound:** The component structure and state management patterns are appropriate for the scale. The main investment needed is in operational concerns (testing, monitoring, deployment automation) rather than fundamental rewrites.

---

**Document End**  
Last Updated: 2026-06-29  
Next Review: After Priority 1 fixes completed
