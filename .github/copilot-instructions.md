# The Friend Archive — Copilot Instructions

> **IMPORTANT:** Every GitHub Copilot session working on this project must read this file in full before suggesting any code. These instructions define the canonical architecture, naming rules, database schema, and business logic that all code in this repository must follow. If you are unsure whether a suggestion is consistent with these instructions, re-read the relevant section before proceeding.

---

## 1. Project Identity

**Official name:** The Friend Archive  
**Tagline:** Track together. Remember always.

The name "The Friend Archive" must appear exactly as written — with correct capitalisation — in every place the application refers to itself: the browser `<title>` tag, all page headings, the README, every documentation file, any SEO metadata, and all marketing copy.

The previous name **"The Archive"** is legacy and must be removed wherever it appears. No variation (e.g. "Friend Archive", "Friends Archive", "the archive") is acceptable outside of prose.

---

## 2. The "movies" Rule (Critical)

The media type for cinema content is **always and without exception called `movie`** (singular, lowercase) in:

- Database column values and enum types
- TypeScript type definitions and interfaces
- React component names and props
- URL path segments (e.g. `/groups/[id]?type=movie`)
- UI labels (e.g. "Movies", "Add a movie")
- All documentation files and comments

**The word "films" must not appear anywhere in the codebase.** This includes variable names, function names, comments, strings, UI text, and documentation. If you see "films" or "Films" anywhere, it is a bug that must be fixed.

The four media types are: `movie`, `tv_series`, `book`, `video_game`.

---

## 3. Tech Stack

| Layer          | Technology              | Notes                                                     |
| -------------- | ----------------------- | --------------------------------------------------------- |
| Framework      | Next.js 15 (App Router) | Pages Router is not used                                  |
| Runtime        | Node.js                 | Vercel deployment target                                  |
| Language       | TypeScript 5 (strict)   | No JavaScript files except config                         |
| Database       | Supabase (PostgreSQL)   | Hosted, managed                                           |
| Auth           | Supabase Auth           | Email + password only                                     |
| Styling        | Tailwind CSS 4          | Via `@tailwindcss/vite` → migrated to PostCSS for Next.js |
| UI Primitives  | Radix UI                | shadcn/ui component pattern                               |
| State (client) | Zustand                 | For UI-only ephemeral state only                          |
| Icons          | lucide-react            |                                                           |
| Deployment     | Vercel                  |                                                           |

**What is NOT in the stack:**

- Pages Router (use App Router exclusively)
- MongoDB (fully removed, replaced by Supabase)
- Vercel serverless functions (removed; logic moved to Supabase RLS + Next.js server components/route handlers)
- React Router (removed; Next.js App Router handles all routing)
- Shared password authentication (fully removed)

---

## 4. Router Decision

This project uses the **Next.js App Router** exclusively.

- All pages live under `app/`
- Server Components are the default; opt into Client Components only when interactivity requires it (event handlers, hooks, browser APIs)
- Route groups use parentheses notation: `(auth)`, `(dashboard)`
- Layout files handle shared UI and session guards at the segment level
- `use client` must appear at the top of any file that uses React hooks, browser APIs, or event handlers

---

## 5. Folder Structure

```
/
├── .github/
│   └── copilot-instructions.md      ← This file
├── app/
│   ├── (auth)/                      ← Unauthenticated routes (no session required)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── reset-password/
│   │       └── page.tsx
│   ├── (dashboard)/                 ← Protected routes (session required, enforced in layout)
│   │   ├── layout.tsx               ← Reads server session; redirects to /login if absent
│   │   ├── dashboard/
│   │   │   └── page.tsx             ← Personal dashboard: user's groups + recent activity
│   │   ├── groups/
│   │   │   ├── new/
│   │   │   │   └── page.tsx         ← Create group form
│   │   │   └── [groupId]/
│   │   │       ├── page.tsx         ← Group detail: media list with filters
│   │   │       └── settings/
│   │   │           └── page.tsx     ← Group settings (owner only)
│   │   ├── discover/
│   │   │   └── page.tsx             ← Browse all public groups
│   │   └── pricing/
│   │       └── page.tsx             ← Subscription plans
│   ├── profile/
│   │   └── [nickname]/
│   │       └── page.tsx             ← Public user profile (viewable by anyone authenticated)
│   ├── upgrade/
│   │   └── page.tsx                 ← Payment placeholder ("coming soon")
│   ├── layout.tsx                   ← Root layout with Supabase provider
│   └── page.tsx                     ← Landing page (unauthenticated home)
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── index.ts
│   ├── ui/                          ← Radix-based primitive wrappers (shadcn pattern)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   └── features/
│       ├── auth/                    ← LoginForm, RegisterForm, ResetPasswordForm
│       ├── groups/                  ← GroupCard, GroupList, CreateGroupDialog, GroupSettings
│       └── media/                   ← MediaTable, AddMediaDialog, MediaFilters, ConsumedByList
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← Browser-side Supabase client (singleton)
│   │   └── server.ts                ← Server-side Supabase client (per-request, uses cookies)
│   └── utils.ts                     ← cn(), formatDate(), and other pure helpers
├── hooks/
│   ├── useMediaItems.ts             ← Client hook for media item CRUD
│   └── useGroups.ts                 ← Client hook for group operations
├── types/
│   └── index.ts                     ← All TypeScript types and interfaces
├── docs/
│   ├── SUPABASE_SETUP.md
│   ├── PROJECT_PLAN.md
│   └── DATA_MODEL.md
├── .env.local                       ← Never committed; see SUPABASE_SETUP.md for required vars
└── middleware.ts                    ← Supabase session refresh on every request
```

**What belongs where:**

- Database queries belong in Server Components, Server Actions, or API route handlers — never directly in Client Components
- The Supabase client must only be initialised in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server). No other file may call `createClient` or `createServerClient`
- UI state (open/closed dialogs, active tabs) belongs in Zustand or `useState` — never in the database
- Business rule enforcement (limits, ownership checks) must be validated by RLS policies at the database level, not only in the application layer

---

## 6. Database Tables

All table names use `snake_case`. The full schema is in `docs/DATA_MODEL.md`. This section provides a quick reference.

| Table                 | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `profiles`            | Public user profiles linked to `auth.users` by UUID                      |
| `subscriptions`       | One row per user recording their current plan and status                 |
| `groups`              | A media-tracking group; has a name, visibility, and owner                |
| `group_members`       | Junction table: which users belong to which group, and in what role      |
| `media_items`         | A media item (movie, TV series, book, or video game) within a group      |
| `consumption_records` | A per-user record of having consumed a specific item, with optional note |

---

## 7. Naming Conventions

| Thing                          | Convention                 | Example                            |
| ------------------------------ | -------------------------- | ---------------------------------- |
| Database tables                | `snake_case`               | `media_items`, `group_members`     |
| Database columns               | `snake_case`               | `added_by`, `release_year`         |
| TypeScript types/interfaces    | `PascalCase`               | `MediaItem`, `GroupMember`         |
| React component files          | `PascalCase.tsx`           | `MediaTable.tsx`, `GroupCard.tsx`  |
| Utility/hook files             | `camelCase.ts`             | `useGroups.ts`, `formatDate.ts`    |
| Environment variables (client) | `NEXT_PUBLIC_` prefix      | `NEXT_PUBLIC_SUPABASE_URL`         |
| Environment variables (server) | No prefix                  | `SUPABASE_SERVICE_ROLE_KEY`        |
| CSS class composition          | `cn()` from `lib/utils.ts` | `cn('base', condition && 'extra')` |

---

## 8. Media Types

The four media types are defined as a PostgreSQL enum and a TypeScript union:

```sql
CREATE TYPE media_type AS ENUM ('movie', 'tv_series', 'book', 'video_game');
```

```typescript
export type MediaType = "movie" | "tv_series" | "book" | "video_game";
```

**Type-specific metadata fields** are stored in a JSONB `metadata` column on `media_items`:

| Type         | Metadata fields                                                          |
| ------------ | ------------------------------------------------------------------------ |
| `movie`      | `director`, `release_year` (integer), `duration_minutes` (integer)       |
| `tv_series`  | `creator`, `release_year` (integer), `seasons` (integer), `platform`     |
| `book`       | `author`, `publication_year` (integer), `publisher`                      |
| `video_game` | `developer`, `publisher`, `release_year` (integer), `platforms` (text[]) |

---

## 9. Item Status

Status values are defined as a PostgreSQL enum:

```sql
CREATE TYPE item_status AS ENUM ('plan_to_consume', 'consuming', 'completed');
```

UI display mapping (used in all labels, never stored in the database):

| Database value    | UI label (movies/TV) | UI label (books) | UI label (games) |
| ----------------- | -------------------- | ---------------- | ---------------- |
| `plan_to_consume` | Plan to Watch        | Plan to Read     | Plan to Play     |
| `consuming`       | Watching             | Reading          | Playing          |
| `completed`       | Watched              | Read             | Played           |

UI behavior rule:

- Status is treated as personal progress in the table UI.
- Setting status to `completed` automatically marks the current user as consumed (creates/keeps `consumption_records` row).
- Setting status away from `completed` removes the current user's consumption row.
- The `Consumed By` table text is derived from `consumption_records` and is not manually edited inline.

---

## 10. Group System

- Any authenticated user can create a group.
- The creator automatically becomes the group's **owner**.
- Two roles exist: `owner` and `member`. There is no moderator or admin role.
- **Owner permissions:** change group name/description/visibility, remove members, delete the group.
- **Member permissions:** add media items, edit media items, mark items as consumed, write personal notes.
- **Visibility:** `public` or `private`. Public groups are discoverable and readable by any authenticated user. Private groups are invisible to non-members.
- Non-members viewing a public group see it in **read-only** mode: no add, edit, or delete buttons.
- A user can be a member of multiple groups simultaneously.

---

## 11. Consumed-By System

Consumption is tracked in the `consumption_records` table — **not** on the media item itself.

- Any group member can mark any item as consumed independently.
- Marking an item consumed creates a row in `consumption_records` with `user_id`, `media_item_id`, `consumed_at`, and an optional `note`.
- The `note` field is limited to **500 characters**, enforced by both a PostgreSQL `CHECK` constraint and a visible character counter in the UI.
- Notes belong to the **consumption record**, not the item — each member has their own note about the same item.
- To check if the current user has consumed an item: query `consumption_records` where `user_id = auth.uid()` and `media_item_id = <item id>`.

Status linkage:

- The table status selector is the source of truth for current-user consumed/not-consumed state in the app UI.
- A manual consumed toggle is intentionally not shown in the item row.

---

## 12. The `added_by` Immutability Rule

The `added_by` column on `media_items` stores the UUID of the user who created the item.

- It is set **automatically on the server** using `auth.uid()` from the Supabase session.
- The UI must **never** provide a field for setting or changing `added_by`.
- An RLS policy prevents any `UPDATE` operation from modifying the `added_by` column after row creation.
- This rule must be enforced at the **database level** so it cannot be bypassed via direct API calls, PostgREST, or the Supabase dashboard.

The exact policy is documented in `docs/SUPABASE_SETUP.md`.

---

## 13. Subscription Plans

| Plan         | Price    | Max groups created | Max groups joined            |
| ------------ | -------- | ------------------ | ---------------------------- |
| `free`       | €0       | 2                  | 5 (total, including created) |
| `premium`    | €3/month | 10                 | Unlimited                    |
| `enterprise` | Custom   | Unlimited          | Unlimited                    |

All new users start on the `free` plan. A row is inserted into `subscriptions` automatically via a database trigger when a new user registers.

**Enforcement:**

- Group creation checks the user's active plan against their current created-group count. If the limit is reached, the operation is rejected with an error directing the user to `/pricing`.
- Group join checks total membership count (created + joined) against the plan limit.
- These checks are enforced by PostgreSQL functions called within RLS policies, not only in application code.

**Payment integration is out of scope.** The `/upgrade` page displays a "coming soon" message. The `premium` and `enterprise` plans can currently only be activated via a service role operation directly in the Supabase dashboard.

---

## 14. Authentication Flow

- **Registration:** email + password + unique nickname → creates `auth.users` row → trigger creates `profiles` row → trigger creates `subscriptions` row (plan = `free`, status = `active`)
- **Login:** email + password → Supabase session cookie → redirect to `/dashboard`
- **Password reset:** Supabase built-in email-based reset flow
- **Session handling:** `middleware.ts` refreshes the session on every request using `@supabase/ssr`. The server-side client in `lib/supabase/server.ts` reads the session from cookies using `next/headers`.
- **Route protection:** The `app/(dashboard)/layout.tsx` server component calls the server Supabase client, checks for a session, and redirects unauthenticated users to `/login`.

---

## 15. Supabase Client Initialisation Rule

The Supabase client must be initialised in exactly two files and nowhere else:

| File                     | Usage                                                           | Package                                 |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| `lib/supabase/client.ts` | Browser-side (Client Components, hooks)                         | `@supabase/ssr` → `createBrowserClient` |
| `lib/supabase/server.ts` | Server-side (Server Components, Server Actions, Route Handlers) | `@supabase/ssr` → `createServerClient`  |

Any call to `createClient`, `createBrowserClient`, or `createServerClient` outside these two files is a bug.

---

## 16. Free Tier Optimisation Rules

These rules must be followed in every query and component:

1. **Always specify columns explicitly.** Never use `select('*')`. Always list the exact columns needed.
2. **Avoid N+1 queries.** Use Supabase's nested select syntax to fetch related data in one round-trip.
3. **No polling.** Prefer manual refresh triggers or optimistic updates.
4. **Realtime sparingly.** Only use Supabase Realtime subscriptions where live updates are essential (currently: none). Document the reason whenever Realtime is added.
5. **No large file storage.** Do not store images or blobs in Supabase Storage unless strictly required.
6. **Client-side caching.** Cache stable reference data (e.g. the current user's group list) in Zustand or React state rather than re-fetching on every render.

---

## 17. Environment Variables

Required in `.env.local` (never committed to version control):

```
NEXT_PUBLIC_SUPABASE_URL=        # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Your Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=       # Server-only; never exposed to the browser
```

Full setup instructions are in `docs/SUPABASE_SETUP.md`.

---

## 18. Things Explicitly Out of Scope (for this migration)

The following are deferred to future work and must NOT be partially implemented:

- **Payment processing** — Stripe or any other payment provider integration
- **Email notifications** — Welcome emails, activity digests (Supabase Auth confirmation emails are in scope)
- **Media search / autocomplete** — Fetching metadata from TMDB, Open Library, etc.
- **File uploads** — Cover images, avatars
- **OAuth providers** — Google, GitHub login (only email + password is in scope)
- **Group join request workflow** — Currently any authenticated user can join a public group directly; a request/approval flow is deferred
- **Item comments / threads** — The personal note on a consumption record is in scope; threaded discussion is not
- **Mobile-specific native features** — PWA manifest, push notifications

---

## 19. Legacy Code to Remove

The following exist in the current codebase and must be **completely removed** during migration:

| Legacy artefact                                       | Replacement                                            |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `api/index.ts` (Vercel function)                      | Supabase RLS + Next.js Server Actions / Route Handlers |
| `src/stores/auth-store.ts` (nickname-only auth)       | Supabase Auth session                                  |
| `src/stores/items-store.ts` (Zustand for server data) | Supabase queries in Server Components                  |
| `src/hooks/useItems.ts` (localStorage sync logic)     | Supabase real-time-optional data fetching              |
| `src/components/ui/restore-prompt.tsx`                | Not needed with real database                          |
| `src/components/ui/sync-prompt.tsx`                   | Not needed with real database                          |
| All `category: "Films"` string references             | Replaced by `type: 'movie'` enum                       |
| `vercel.json` rewrites for `/api/:path*`              | Replaced by Next.js App Router structure               |

---

## 20. Updating These Instructions

This file must be updated whenever:

- A new table is added to the database schema
- A significant architectural decision changes (e.g. new auth provider, new caching strategy)
- A previously out-of-scope feature is brought into scope
- A naming convention is added or revised

After updating, document the change at the bottom of this file with a date and a one-line summary.

---

## 21. Frontend Quality System (Mandatory)

The Friend Archive frontend must follow the design and interaction rules below.

### 21.1 Design Tokens (single source of truth)

- All visual values must come from the token system in `app/globals.css`.
- Use semantic token names for colors (`background`, `surface`, `surface-elevated`, `border`, `text-primary`, `text-secondary`, `text-muted`, `accent`, `accent-hover`, `destructive`, `success`, `warning`).
- Do not add ad-hoc hex values in component files.
- Reuse standardized radius, shadow, spacing, duration, easing, and z-index tokens.

### 21.2 Button Variant System

- All buttons must use shared `Button` variants only.
- Allowed variants: `primary` (or legacy `default`), `secondary`, `ghost`, `destructive`, `link`, plus `outline` for bordered secondary CTAs.
- No page-specific one-off button styles.
- Loading buttons must show inline spinner + disabled state.

### 21.3 Motion Philosophy

- Use Framer Motion for route/list/state transitions where motion adds spatial clarity.
- Motion should be subtle and fast (active phase <= 350ms).
- Animate user-triggered and state-change transitions; do not animate passive static copy blocks.
- Keep list cascades short (full sequence <= 400ms).

### 21.4 Loading State Pattern

- Server/data-loading surfaces must use skeletons that resemble real layout shapes.
- Inline async actions must use in-button spinner + disabled controls.
- Avoid blank content flashes while loading.

### 21.5 Error and Empty State Pattern

- Field validation errors should appear close to their fields.
- Form-level server/network errors should use a consistent banner pattern (friendly language, no raw internal error messages).
- Page-level fetch failures need clear recovery actions (retry/back/navigation).
- Empty states should include a concise explanation and a clear CTA.

### 21.6 Mobile-First Interaction Rules

- Minimum tap target: 44x44 for all interactive controls.
- Forms and dialogs must remain usable at 390px width without pinch zoom.
- Dense data views (especially media lists) must provide a mobile layout (not desktop table squeeze).
- Any modal on mobile should use full-screen or near-full-screen behavior with clear close control.

### 21.7 Cursor and Interactivity Rules

- Clickable elements: `cursor-pointer`.
- Text inputs/textareas: `cursor-text`.
- Disabled controls: `cursor-not-allowed` and muted visuals.
- Icon-only actions still need obvious interaction affordance and accessible labels.

---

## Changelog

| Date       | Change                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| 2026-05-31 | Initial instructions written during migration from Vite SPA to Next.js + Supabase   |
| 2026-06-01 | Documented status-to-consumption auto-sync behavior and consumed-by display rules   |
| 2026-06-01 | Added mandatory frontend design tokens, motion, loading/error, and button standards |
