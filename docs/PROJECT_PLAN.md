# Project Plan — The Friend Archive Migration

This document contains the complete restructuring roadmap for migrating The Friend Archive from its current architecture (Vite SPA + Vercel in-memory serverless function) to a production-ready Next.js 15 + Supabase application.

---

## Current State Analysis

Before reading the phases, understand what the project currently is and what it is not.

### What exists today

| Artefact         | Current state                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework        | Vite + React 19 SPA (single-page, client-rendered)                                                                                                                                   |
| Routing          | None — `App.tsx` renders `<LoginForm />` or `<Dashboard />` directly                                                                                                                 |
| Auth             | Shared password stored in env var `ARCHIVE_PASSWORD` (default: `archive2024`). Nickname + password login. Session stored in localStorage via Zustand persist. No real user accounts. |
| Database         | In-memory `Map` inside a single Vercel function. **Resets on every cold start.** No real persistence.                                                                                |
| Backend          | Single Vercel function at `api/index.ts` handling all routes: auth login, item CRUD, tag listing                                                                                     |
| Categories       | "Films", "TV Series", "Books" — no video games category                                                                                                                              |
| Status system    | 6 string values: "Plan to Watch", "Watching", "Watched", "Plan to Read", "Reading", "Read"                                                                                           |
| Pages            | 1 page: Dashboard (everything in one view)                                                                                                                                           |
| Groups           | None — all items are in one shared global list                                                                                                                                       |
| Subscriptions    | None                                                                                                                                                                                 |
| User profiles    | None                                                                                                                                                                                 |
| Public discovery | None                                                                                                                                                                                 |

### What does NOT exist yet

- Next.js (the whole framework is Vite)
- Supabase (not configured, no credentials)
- Real database persistence
- Real user accounts (email + password)
- Groups
- Subscription plans
- User profiles
- Public group discovery
- Video game media type
- Landing page
- Register / password-reset pages
- Group detail, settings, create pages
- Pricing page

---

## Page Inventory: Existing vs New

| Page                  | Route                        | Exists today?                              | Status  |
| --------------------- | ---------------------------- | ------------------------------------------ | ------- |
| Landing / home        | `/`                          | No                                         | New     |
| Login                 | `/login`                     | Partial (LoginForm component, no route)    | Rebuild |
| Register              | `/register`                  | No                                         | New     |
| Password reset        | `/reset-password`            | No                                         | New     |
| Dashboard             | `/dashboard`                 | Partial (Dashboard page, single-page only) | Rebuild |
| Create group          | `/groups/new`                | No                                         | New     |
| Group detail          | `/groups/[groupId]`          | No                                         | New     |
| Group settings        | `/groups/[groupId]/settings` | No                                         | New     |
| Discover              | `/discover`                  | No                                         | New     |
| User profile          | `/profile/[nickname]`        | No                                         | New     |
| Pricing               | `/pricing`                   | No                                         | New     |
| Upgrade (placeholder) | `/upgrade`                   | No                                         | New     |

---

## Phase Overview

| Phase | Focus                       | Dependency           |
| ----- | --------------------------- | -------------------- |
| 1     | Supabase setup + schema     | None — must be first |
| 2     | Next.js scaffold + auth     | Phase 1              |
| 3     | Group system                | Phase 2              |
| 4     | Media catalog               | Phase 3              |
| 5     | Subscription tier system    | Phase 3              |
| 6     | Public profiles + discovery | Phases 3, 4          |

---

## Phase 1 — Supabase Setup and Database Schema

**Goal:** A fully configured Supabase project with all tables, enums, indexes, triggers, RLS policies, and auth settings in place before any application code is written.

**Dependencies:** None. This phase must be completed before any other phase begins.

### Tasks

- [ ] **1.1** Create the Supabase project via the dashboard (see `docs/SUPABASE_SETUP.md` § 1)
- [ ] **1.2** Add environment variables to `.env.local` (see `docs/SUPABASE_SETUP.md` § 2)
- [ ] **1.3** Run Step 1 migration: create all enum types
- [ ] **1.4** Run Step 2 migration: create all six tables in dependency order
- [ ] **1.5** Run Step 3 migration: create all indexes
- [ ] **1.6** Run Step 4 migration: create functions and triggers (updated_at, new user handler, new group handler, limit helpers)
- [ ] **1.7** Run Step 5 migration: enable RLS and create all policies
- [ ] **1.8** Configure Supabase Auth (email provider, redirect URLs)
- [ ] **1.9** Run the verification queries from `docs/SUPABASE_SETUP.md` § 6 and confirm all pass

**What is replaced:** Nothing in the application yet — this phase is infrastructure only.

---

## Phase 2 — Next.js Scaffold and Authentication

**Goal:** Replace the Vite SPA with a Next.js 15 App Router project. Implement working registration, login, password reset, and session management. The result of this phase is a Next.js app where a user can create a real account and be redirected to a placeholder dashboard.

**Dependencies:** Phase 1 must be complete (Supabase project and auth must be configured).

### Tasks

- [ ] **2.1** Initialise Next.js 15 project with TypeScript and App Router
  - Run: `npx create-next-app@latest . --typescript --app --no-src-dir --tailwind --eslint`
  - Select "no" for the default import alias change (keep `@/` alias)
- [ ] **2.2** Install Supabase dependencies
  - `@supabase/ssr` — for Next.js server/client integration
  - `@supabase/supabase-js` — base client
- [ ] **2.3** Migrate Radix UI and shadcn-style component dependencies from existing `package.json`
- [ ] **2.4** Create `lib/supabase/client.ts` — browser-side Supabase client using `createBrowserClient`
- [ ] **2.5** Create `lib/supabase/server.ts` — server-side Supabase client using `createServerClient` with cookie handling
- [ ] **2.6** Create `middleware.ts` — refreshes session cookies on every request using `updateSession` from `@supabase/ssr`
- [ ] **2.7** Port `lib/utils.ts` — copy `cn()`, `formatDate()`, and other pure helpers
- [ ] **2.8** Create `types/index.ts` — define all TypeScript types: `MediaType`, `ItemStatus`, `GroupRole`, `SubscriptionPlan`, `Profile`, `Group`, `GroupMember`, `MediaItem`, `ConsumptionRecord`
- [ ] **2.9** Migrate UI primitives from `src/components/ui/` to `components/ui/` — port `button`, `input`, `label`, `dialog`, `select`, `dropdown-menu`, `badge`, `checkbox`, `tabs` (removing `restore-prompt` and `sync-prompt` which are no longer needed)
- [ ] **2.10** Create `app/layout.tsx` — root layout, sets `<title>The Friend Archive</title>`, includes the Supabase session provider
- [ ] **2.11** Create `app/page.tsx` — landing page for unauthenticated visitors. Describes the product and links to `/login` and `/register`.
- [ ] **2.12** Create `app/(auth)/login/page.tsx` — email + password login form. On success, redirects to `/dashboard`.
- [ ] **2.13** Create `app/(auth)/register/page.tsx` — email + password + nickname registration form. Validates nickname uniqueness before calling `supabase.auth.signUp`. On success, redirects to `/dashboard`.
- [ ] **2.14** Create `app/(auth)/reset-password/page.tsx` — password reset request form and the update-password form (handles both steps of Supabase's reset flow).
- [ ] **2.15** Create `app/(dashboard)/layout.tsx` — reads server session; redirects to `/login` if no session exists. This protects all routes under `(dashboard)`.
- [ ] **2.16** Create `app/(dashboard)/dashboard/page.tsx` — placeholder page displaying the current user's nickname and a "no groups yet" empty state.
- [ ] **2.17** Create `components/layout/Header.tsx` — shared header with app name, current user nickname, and logout button.

**What is replaced:**

- `src/App.tsx` routing logic → Next.js App Router
- `src/features/auth/LoginForm.tsx` → `app/(auth)/login/page.tsx` + `components/features/auth/LoginForm.tsx`
- `src/stores/auth-store.ts` → Supabase Auth session
- `api/index.ts` auth routes → Supabase Auth

**What is kept/ported:**

- All Radix UI component wrappers (updated file paths)
- `cn()` utility
- Visual design (stone/amber dark theme)

---

## Phase 3 — Group System

**Goal:** Implement the complete group creation, membership, and settings system. After this phase, users can create groups, request access to other groups (membership is granted when the owner approves), view their groups on the dashboard, and manage group settings.

**Dependencies:** Phase 2 (authentication must be working).

### Tasks

- [ ] **3.1** Create `app/(dashboard)/groups/new/page.tsx` — form to create a new group (name, description, visibility). Checks subscription limits before allowing creation. Shows error message with link to `/pricing` if limit reached.
- [ ] **3.2** Create `app/(dashboard)/groups/[groupId]/page.tsx` — group detail page shell (media list comes in Phase 4). Shows group name, description, member list, and an empty state if no items exist yet. Non-members viewing a public group see a read-only banner.
- [ ] **3.3** Create `app/(dashboard)/groups/[groupId]/settings/page.tsx` — group settings page. Only accessible to the group owner (redirect non-owners to the group detail page). Fields: name, description, visibility. Includes a "Danger Zone" section with delete group and remove member controls.
- [ ] **3.4** Create `components/features/groups/GroupCard.tsx` — card component displaying group name, description, visibility badge, member count, and item count. Used on the dashboard.
- [ ] **3.5** Create `components/features/groups/GroupList.tsx` — renders a list of `GroupCard` components. Used on the dashboard and discover page.
- [ ] **3.6** Update `app/(dashboard)/dashboard/page.tsx` — fetch and display the current user's groups using a Server Component query. Show "Create your first group" CTA if no groups exist.
- [ ] **3.7** Implement request-to-join flow — joining any group (public or private) requires owner approval. A non-member sees a "Request to join" button: on a public group's page alongside the read-only content, on a private group's link as a blocked page showing only the group name. The request calls `request_group_access()`; the owner is notified (header bell + group settings) and approves via `approve_join_request()` (which checks `can_join_group()` for the requester) or declines via `decline_join_request()`. A declined requester may request again; a pending request can be cancelled with `cancel_join_request()`.
- [ ] **3.8** Implement leave group flow — on the group detail page (for members who are not owners), show a "Leave Group" option.
- [ ] **3.9** Create `hooks/useGroups.ts` — client hook for group mutations (create, update, delete) used in Client Component forms.

**What is replaced:**

- Nothing from the existing codebase directly — groups are entirely new.

---

## Phase 4 — Media Catalog

**Goal:** Implement the full media catalog within groups, preserving and improving the filtering, category tabs, and table display from the existing Vite app. This is the core feature of the application.

**Dependencies:** Phase 3 (groups must exist before items can belong to them).

### Tasks

- [ ] **4.1** Create `components/features/media/MediaFilters.tsx` — port `FilterBar.tsx` from the Vite app. Adapts to the new 4-type system. Filters: search text, media type (movie/tv_series/book/video_game), status, added_by. Replace old status string values with the new enum display mapping.
- [ ] **4.2** Create `components/features/media/MediaTypeTabs.tsx` — port `CategoryTabs.tsx`. Tab IDs are now the enum values (`movie`, `tv_series`, `book`, `video_game`) plus an `all` tab. Tab labels: "All", "Movies" (not "Films"), "TV Series", "Books", "Games". Icons: Film, Tv, BookOpen, Gamepad2.
- [ ] **4.3** Create `components/features/media/MediaTable.tsx` — port `ItemsTable.tsx`. Key changes: uses `MediaItem` type from Supabase schema, column definitions derived from media type, consumed_by column shows consumption record data from joined `consumption_records` query.
- [ ] **4.4** Create `components/features/media/AddMediaDialog.tsx` — port `AddItemDialog.tsx`. Key changes: category selector replaced with type selector (movie/tv_series/book/video_game), properties dynamically shown based on type, `added_by` is no longer a form field (set automatically on server).
- [ ] **4.5** Create `components/features/media/ConsumedByList.tsx` — replaces the old `watchedBy`/`plannedBy` arrays. Shows a list of group members who have a `consumption_record` for the item. Each entry may show the member's nickname and their optional note.
- [ ] **4.6** Create `hooks/useMediaItems.ts` — client hook for media item mutations (create, update, delete, mark consumed, remove consumed).
- [ ] **4.7** Update `app/(dashboard)/groups/[groupId]/page.tsx` — integrate `MediaTypeTabs`, `MediaFilters`, and `MediaTable`. Server Component fetches initial items; Client Components handle filtering and mutations.
- [ ] **4.8** Implement note functionality — within `ConsumedByList` or a separate dialog, allow a user to add/edit their personal consumption note (max 500 chars). Character counter must be visible in the UI.

**What is replaced:**

- `src/features/items/CategoryTabs.tsx` → `components/features/media/MediaTypeTabs.tsx`
- `src/features/items/FilterBar.tsx` → `components/features/media/MediaFilters.tsx`
- `src/features/items/ItemsTable.tsx` → `components/features/media/MediaTable.tsx`
- `src/features/items/AddItemDialog.tsx` → `components/features/media/AddMediaDialog.tsx`
- `src/features/items/EditableCell.tsx` → inline editing within `MediaTable.tsx` (or a dedicated component)
- `src/hooks/useItems.ts` → `hooks/useMediaItems.ts`
- `src/stores/items-store.ts` → Supabase queries (no client-side data store for server data)
- `api/index.ts` item CRUD routes → Supabase client calls + Server Actions

**What is kept/improved:**

- Dark stone/amber visual theme
- Tag-based filtering
- Inline status editing
- Column visibility toggle
- Sort by any column

---

## Phase 5 — Subscription Tier System

**Goal:** Build the subscription infrastructure and pricing page. Payment processing is not in scope, but the database enforcement of limits must be fully working, and the pricing page must clearly present all three plans.

**Dependencies:** Phase 3 (groups must exist to demonstrate limits meaningfully).

### Tasks

- [ ] **5.1** Create `app/(dashboard)/pricing/page.tsx` — three-column pricing table showing Free (€0), Premium (€3/month), and Enterprise (Custom) plans. Each column lists features and limits. "Get started" / "Upgrade" CTAs. The "Upgrade" button for Premium links to `/upgrade`.
- [ ] **5.2** Create `app/upgrade/page.tsx` — placeholder page. Displays a clear message: "Payment integration is coming soon. To activate Premium or Enterprise, please contact us." No form or payment widget.
- [ ] **5.3** Verify limit enforcement — test that:
  - A free user who owns 2 groups cannot create a third (receives an error message directing them to `/pricing`)
  - A free user who belongs to 5 groups cannot be approved into a sixth (`approve_join_request()` fails with `plan_limit_reached`)
  - The error messages in the UI clearly reference the plan limits and the pricing page
- [ ] **5.4** Add subscription plan badge to `app/(dashboard)/dashboard/page.tsx` — shows the current user's plan (Free / Premium / Enterprise) with a link to `/pricing` for free users.

**What is replaced:** Nothing — subscriptions are entirely new.

---

## Phase 6 — Public Profiles and Discovery

**Goal:** Implement the public user profile page and the group discovery page. These are read-oriented features that make the platform feel social.

**Dependencies:** Phases 3 and 4 (groups and items must exist to have anything to display).

### Tasks

- [ ] **6.1** Create `app/profile/[nickname]/page.tsx` — public profile page. Fetches the user's profile by nickname. Displays their nickname, join date, and all their **public** groups (as `GroupCard` components). Any authenticated user can view this page. If the profile does not exist, show a 404.
- [ ] **6.2** Create `app/(dashboard)/discover/page.tsx` — browse all public groups from all users. Server Component fetches public groups ordered by most recently created. Each group shows name, description, owner nickname, member count, and item count. Authenticated users can click into any public group.
- [ ] **6.3** Update `components/layout/Header.tsx` — add a link to the current user's public profile and a link to `/discover` in the navigation.
- [ ] **6.4** Link nicknames throughout the app — wherever a user's nickname appears (e.g. "Added by", member lists), make it a link to their public profile page.

**What is replaced:** Nothing — profiles and discovery are entirely new.

---

## Cleanup Tasks (after all phases)

These tasks can be done incrementally throughout the migration but must be complete before the project is considered done.

- [ ] **C.1** Remove all files under `src/` (the old Vite app source)
- [ ] **C.2** Remove `api/` directory (Vercel function)
- [ ] **C.3** Remove `vite.config.ts`, `index.html`, `vercel.json` (Vite/old Vercel config)
- [ ] **C.4** Update `package.json` to remove Vite, React Router, MongoDB, `@vercel/node` dependencies
- [ ] **C.5** Update `README.md` to describe the new architecture
- [ ] **C.6** Search the codebase for any remaining occurrences of "Films", "film", "The Archive" (old name), "archive2024" (old password), "watchedBy", "plannedBy", "localStorage" — remove or replace all of them
- [ ] **C.7** Run a full TypeScript type check with `tsc --noEmit` and resolve all errors
- [ ] **C.8** Run ESLint and resolve all warnings

---

## Migration Risk Notes

| Risk                                      | Mitigation                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data loss during migration                | The current in-memory store resets on cold starts anyway — there is no real data to migrate. Demo items in `api/index.ts` can be seeded manually via Supabase SQL if needed.    |
| Vite to Next.js CSS differences           | Tailwind CSS 4 via `@tailwindcss/vite` must be migrated to PostCSS for Next.js compatibility. Install `@tailwindcss/postcss` and update `postcss.config.js`.                    |
| `@radix-ui/react-*` version compatibility | All Radix packages in `package.json` are compatible with React 19. No changes needed.                                                                                           |
| Auth store in localStorage                | The existing Zustand persist auth store stores the session in localStorage. This is entirely replaced by Supabase's cookie-based session management — no migration path needed. |
