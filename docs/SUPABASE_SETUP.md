# Supabase Setup Guide

This document is the complete, authoritative guide to configuring Supabase for The Friend Archive from scratch. A developer who has never seen this project before should be able to follow this guide and arrive at a fully configured, production-ready backend.

---

## Table of Contents

1. [Create the Supabase Project](#1-create-the-supabase-project)
2. [Environment Variables](#2-environment-variables)
3. [Database Migrations](#3-database-migrations)
   - [Step 1 — Enum Types](#step-1--enum-types)
   - [Step 2 — Core Tables](#step-2--core-tables)
   - [Step 3 — Indexes](#step-3--indexes)
   - [Step 4 — Functions and Triggers](#step-4--functions-and-triggers)
   - [Step 5 — Row Level Security](#step-5--row-level-security)
4. [Auth Configuration](#4-auth-configuration)
5. [Free Tier Optimisation](#5-free-tier-optimisation)
6. [Verifying the Setup](#6-verifying-the-setup)

---

## 1. Create the Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in or create an account.
2. Click **New project**.
3. Select your organisation (or create one).
4. Set **Name** to `friends-archive` (or any name you prefer — this is internal).
5. Set a strong **Database password** and save it in your password manager. You will not need it in code but you may need it for direct database access.
6. Select the **Region** closest to your primary user base.
7. Choose the **Free** plan unless you are setting up production.
8. Click **Create new project** and wait for provisioning (typically 1–2 minutes).

---

## 2. Environment Variables

Once the project is provisioned, navigate to **Project Settings → API** in the Supabase dashboard.

Create a `.env.local` file in the root of the Next.js project. This file must **never** be committed to version control — it is already in `.gitignore`.

```env
# .env.local

# ── Supabase ─────────────────────────────────────────────────────────────────

# Your Supabase project URL. Found in Project Settings → API → Project URL.
# This value is safe to expose to the browser.
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# The anon/public API key. Found in Project Settings → API → Project API keys → anon public.
# This value is safe to expose to the browser. It is restricted by RLS policies.
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# The service role key. Found in Project Settings → API → Project API keys → service_role.
# THIS KEY BYPASSES ROW LEVEL SECURITY. Never expose it in client-side code or commit it.
# Used only in server-side scripts and administrative operations.
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Variable Reference

| Variable                        | Where used                                                          | Exposed to browser        |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` | Yes (safe)                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` | Yes (safe — RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only scripts, admin operations                               | **Never**                 |

---

## 3. Database Migrations

Run all SQL blocks below in order using the **Supabase SQL Editor** (Dashboard → SQL Editor → New query). Each block is idempotent where possible. Run them in the numbered sequence — later steps depend on types and tables created in earlier ones.

### How to Use the SQL Editor

If you have never used the Supabase SQL Editor before, here is exactly what to do for each step:

1. Open your project on [https://supabase.com/dashboard](https://supabase.com/dashboard) and click your project name.
2. In the left sidebar, click **SQL Editor** (it looks like a code icon `</>`).
3. Click **New query** in the top-left of the editor panel. A blank editor tab opens.
4. Copy the entire SQL block from the step below (including all comments — they are harmless).
5. Paste it into the editor.
6. Click the green **Run** button (or press `Cmd+Enter` on Mac / `Ctrl+Enter` on Windows).
7. Look at the bottom panel:
   - **"Success. No rows returned"** → the statement ran correctly. Move to the next step.
   - **"ERROR: ..."** → read the error message. The most common causes are listed below.
8. Repeat for each SQL block in order.

> **Tip:** You do not need to clear the editor between steps. You can open a fresh tab for each step by clicking **New query** again. This keeps a history of what you ran.

### Common Errors and How to Fix Them

| Error message                                                                       | Cause                                                                                   | Fix                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `type "media_type" already exists`                                                  | You ran Step 1 twice.                                                                   | Safe to ignore — the types already exist. Continue.      |
| `relation "profiles" already exists`                                                | You ran Step 2a twice.                                                                  | Safe to ignore. Continue.                                |
| `there is no unique constraint matching given keys for referenced table "profiles"` | You are running Step 2b (subscriptions) before Step 2a (profiles).                      | Run the steps in order.                                  |
| `syntax error at or near ...`                                                       | A copy-paste issue cut off part of the SQL.                                             | Re-copy the full block from this document and try again. |
| `permission denied for table auth.users`                                            | You are not using the SQL Editor — you may be trying to run this via the PostgREST API. | Use the Supabase dashboard SQL Editor, not the API.      |

---

### Step 1 — Enum Types

```sql
-- Media type: the four supported content categories.
-- IMPORTANT: 'movie' is the canonical value for cinema content.
-- The word 'film' or 'films' must never appear here or anywhere in the codebase.
CREATE TYPE media_type AS ENUM ('movie', 'tv_series', 'book', 'video_game');

-- Item status: a group's collective progress on a media item.
CREATE TYPE item_status AS ENUM ('plan_to_consume', 'consuming', 'completed');

-- Group visibility: determines discoverability.
CREATE TYPE group_visibility AS ENUM ('public', 'private');

-- Group member role: exactly two roles, no intermediate moderator level.
CREATE TYPE group_role AS ENUM ('owner', 'member');

-- Subscription plan: the three tiers of the application.
CREATE TYPE subscription_plan AS ENUM ('free', 'premium', 'enterprise');

-- Subscription status: lifecycle state of a subscription record.
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trialing');
```

**Expected result:** `Success. No rows returned` — 6 times, once per `CREATE TYPE` statement. You can verify by going to **Database → Types** in the left sidebar and confirming all six types are listed.

---

### Step 2 — Core Tables

Run each `CREATE TABLE` statement separately to make errors easier to diagnose.

#### 2a — profiles

```sql
-- Public user profiles. One row per user, linked to auth.users by UUID.
-- This table is readable by any authenticated user so nicknames can be displayed.
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT nickname_length CHECK (char_length(nickname) BETWEEN 2 AND 30),
  CONSTRAINT nickname_format CHECK (nickname ~ '^[a-zA-Z0-9_\-]+$')
);

COMMENT ON TABLE public.profiles IS
  'Public user profiles. Linked to auth.users. Readable by all authenticated users.';
COMMENT ON COLUMN public.profiles.nickname IS
  'Unique public display name. 2–30 chars, alphanumeric plus underscores and hyphens.';
```

**Expected result:** `Success. No rows returned` — the `profiles` table now appears under **Database → Tables**.

#### 2b — subscriptions

```sql
-- One subscription record per user. Tracks their current plan and limits.
-- Inserted automatically by trigger on new user registration (plan = free).
CREATE TABLE public.subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan        subscription_plan NOT NULL DEFAULT 'free',
  status      subscription_status NOT NULL DEFAULT 'active',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.subscriptions IS
  'Tracks the current subscription plan for each user. Managed server-side only.';
COMMENT ON COLUMN public.subscriptions.ends_at IS
  'NULL for active subscriptions. Set when a subscription is cancelled or expires.';
```

**Expected result:** `Success. No rows returned` — `subscriptions` table appears in **Database → Tables**.

#### 2c — groups

```sql
-- A media-tracking group created and owned by one user.
CREATE TABLE public.groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  visibility   group_visibility NOT NULL DEFAULT 'private',
  owner_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT group_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT group_description_length CHECK (description IS NULL OR char_length(description) <= 500)
);

COMMENT ON TABLE public.groups IS
  'A collaborative media-tracking group. Has an owner who controls settings and membership.';
COMMENT ON COLUMN public.groups.owner_id IS
  'The user who created this group. Cannot be transferred (future feature).';
```

**Expected result:** `Success. No rows returned` — `groups` table appears in **Database → Tables**.

#### 2d — group_members

```sql
-- Junction table: records which users belong to which groups and in what role.
-- The owner is also inserted here as role = owner when they create the group.
CREATE TABLE public.group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       group_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

COMMENT ON TABLE public.group_members IS
  'Membership junction table. A user can belong to multiple groups in different roles.';
COMMENT ON COLUMN public.group_members.role IS
  'owner = full control; member = can add/edit items and mark consumption.';
```

**Expected result:** `Success. No rows returned` — `group_members` table appears in **Database → Tables**.

#### 2e — media_items

```sql
-- A single media item (movie, TV series, book, or video game) within a group.
-- Type-specific metadata is stored in the JSONB `metadata` column.
-- See DATA_MODEL.md for the full rationale and per-type field specification.
CREATE TABLE public.media_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        media_type NOT NULL,
  status      item_status NOT NULL DEFAULT 'plan_to_consume',
  genre       TEXT,
  added_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT title_length CHECK (char_length(title) BETWEEN 1 AND 500),
  CONSTRAINT genre_length CHECK (genre IS NULL OR char_length(genre) <= 100)
);

COMMENT ON TABLE public.media_items IS
  'A media item in a group. added_by is immutable after insert (enforced by RLS).';
COMMENT ON COLUMN public.media_items.added_by IS
  'UUID of the user who created this item. Set server-side; immutable after insert.';
COMMENT ON COLUMN public.media_items.metadata IS
  'JSONB bag of type-specific fields. Schema varies by type — see DATA_MODEL.md.';
```

**Expected result:** `Success. No rows returned` — `media_items` table appears in **Database → Tables**.

#### 2f — consumption_records

```sql
-- Tracks which users have consumed which items, with an optional personal note.
-- One row per (user, item) pair. Notes are per-user, not shared.
CREATE TABLE public.consumption_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id   UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consumed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_consumption UNIQUE (media_item_id, user_id),
  CONSTRAINT note_length CHECK (note IS NULL OR char_length(note) <= 500)
);

COMMENT ON TABLE public.consumption_records IS
  'Per-user consumption tracking. Each member independently records whether they consumed an item.';
COMMENT ON COLUMN public.consumption_records.note IS
  'Optional personal note (max 500 chars). Private to the user who wrote it until displayed in group context.';
```

**Expected result:** `Success. No rows returned` — `consumption_records` table appears in **Database → Tables**.

At this point all 6 tables should be visible under **Database → Tables**: `profiles`, `subscriptions`, `groups`, `group_members`, `media_items`, `consumption_records`.

#### 2g — Grant table access to Supabase API roles

RLS policies do **not** replace normal PostgreSQL privileges. If you skip the grants below, Supabase can still fail with plain errors such as `permission denied for table groups` even when your policies are correct.

```sql
-- Allow Supabase API roles to use the public schema.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Authenticated users can read and mutate tables, but RLS still decides which
-- rows they are actually allowed to access.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Future tables in the public schema should inherit the same authenticated grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
```

**Expected result:** `Success. No rows returned` — authenticated API calls can now reach your RLS policies instead of failing early with plain permission errors.

---

### Step 3 — Indexes

```sql
-- profiles: lookup by nickname (for profile pages and uniqueness checks)
CREATE INDEX idx_profiles_nickname ON public.profiles (nickname);

-- subscriptions: lookup by user_id
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions (user_id);

-- groups: lookup by owner, by visibility for discovery page
CREATE INDEX idx_groups_owner_id ON public.groups (owner_id);
CREATE INDEX idx_groups_visibility ON public.groups (visibility);

-- group_members: lookup by user (all groups a user belongs to) and by group (all members)
CREATE INDEX idx_group_members_user_id ON public.group_members (user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members (group_id);

-- media_items: lookup by group, by type, by status, and by added_by
CREATE INDEX idx_media_items_group_id ON public.media_items (group_id);
CREATE INDEX idx_media_items_type ON public.media_items (type);
CREATE INDEX idx_media_items_status ON public.media_items (status);
CREATE INDEX idx_media_items_added_by ON public.media_items (added_by);

-- consumption_records: lookup by user (all items a user consumed) and by item (all consumers)
CREATE INDEX idx_consumption_records_user_id ON public.consumption_records (user_id);
CREATE INDEX idx_consumption_records_media_item_id ON public.consumption_records (media_item_id);
```

**Expected result:** `Success. No rows returned` — all 11 index creation statements succeed. You can verify under **Database → Indexes** in the sidebar.

---

### Step 4 — Functions and Triggers

#### 4a — updated_at auto-update

```sql
-- Generic trigger function to keep updated_at current on any table.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all tables that have an updated_at column.
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_media_items_updated_at
  BEFORE UPDATE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_consumption_records_updated_at
  BEFORE UPDATE ON public.consumption_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

**Expected result:** `Success. No rows returned` — the function and all five triggers are created. You can verify under **Database → Functions** (look for `handle_updated_at`) and **Database → Triggers**.

#### 4b — Auto-create profile and subscription on registration

```sql
-- Called after a new row is inserted into auth.users.
-- Creates the public profile and a default free subscription.
-- The nickname is passed via user_metadata during registration.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nickname'
  );

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

> **Note:** The `nickname` value must be passed as `options.data.nickname` in the `supabase.auth.signUp()` call. The trigger reads it from `raw_user_meta_data`.

**Expected result:** `Success. No rows returned` — `handle_new_user` appears in **Database → Functions** and `trg_on_auth_user_created` appears in **Database → Triggers**. This is the most important trigger — it is what automatically creates a user’s profile and subscription when they register.

#### 4c — Subscription limit helper functions

```sql
-- Returns the maximum number of groups a user can own based on their plan.
CREATE OR REPLACE FUNCTION public.get_max_groups_owned(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan subscription_plan;
BEGIN
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  RETURN CASE v_plan
    WHEN 'free'       THEN 2
    WHEN 'premium'    THEN 10
    WHEN 'enterprise' THEN 2147483647  -- effectively unlimited
    ELSE 2
  END;
END;
$$;

-- Returns the maximum total group memberships (owned + joined) for a user.
-- NULL means unlimited.
CREATE OR REPLACE FUNCTION public.get_max_groups_total(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan subscription_plan;
BEGIN
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  RETURN CASE v_plan
    WHEN 'free'       THEN 5
    WHEN 'premium'    THEN 2147483647  -- effectively unlimited
    WHEN 'enterprise' THEN 2147483647
    ELSE 5
  END;
END;
$$;

-- Returns true if the user is currently within their plan's group-creation limit.
CREATE OR REPLACE FUNCTION public.can_create_group(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owned_count INTEGER;
  v_max_owned   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_owned_count
  FROM public.groups
  WHERE owner_id = p_user_id;

  v_max_owned := public.get_max_groups_owned(p_user_id);

  RETURN v_owned_count < v_max_owned;
END;
$$;

-- Returns true if the user can join one more group without exceeding their plan's total limit.
CREATE OR REPLACE FUNCTION public.can_join_group(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count INTEGER;
  v_max_total   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM public.group_members
  WHERE user_id = p_user_id;

  v_max_total := public.get_max_groups_total(p_user_id);

  RETURN v_total_count < v_max_total;
END;
$$;
```

**Expected result:** `Success. No rows returned` — four functions (`get_max_groups_owned`, `get_max_groups_total`, `can_create_group`, `can_join_group`) appear in **Database → Functions**.

#### 4d — Auto-insert owner as group member on group creation

```sql
-- When a group is created, automatically insert the owner into group_members.
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();
```

**Expected result:** `Success. No rows returned` — `handle_new_group` and `trg_on_group_created` appear in **Database → Functions** and **Database → Triggers** respectively.

#### 4e — Revoke public execute on internal functions

All `SECURITY DEFINER` functions are callable via the PostgREST API by default. Revoke that access — none of these should be callable directly by API clients.

```sql
-- Revoke from unauthenticated (anon) callers — none of these are public API.
REVOKE EXECUTE ON FUNCTION public.can_create_group(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_join_group(uuid)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_max_groups_owned(uuid)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_max_groups_total(uuid)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()            FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_group()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_public(uuid)        FROM anon;

-- Revoke from authenticated callers for functions that are only ever called
-- internally by the DB engine (triggers) or by other SECURITY DEFINER functions.
-- can_create_group / can_join_group / is_group_member / is_group_public are
-- intentionally left callable by authenticated because RLS policies invoke them.
REVOKE EXECUTE ON FUNCTION public.get_max_groups_owned(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_max_groups_total(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_group()         FROM authenticated;
```

**Expected result:** `Success. No rows returned` — all REVOKE statements succeed. The functions still work (RLS policies and triggers call them internally) but they can no longer be invoked via `/rest/v1/rpc/...`.

---

### Step 5 — Row Level Security

> **Important — RLS recursion:** The `groups` SELECT policy needs to check `group_members` to see if the current user is a member, and the `group_members` SELECT policy needs to check `groups` to see if a group is public. This creates a circular reference that PostgreSQL will reject with *"infinite recursion detected in policy"*. The fix is two `SECURITY DEFINER` helper functions that bypass RLS for those inner lookups. Run these **before** enabling RLS.

#### 5-pre — Anti-recursion helpers

```sql
-- Checks whether a user is a member of a group.
-- SECURITY DEFINER bypasses group_members RLS, breaking the circular reference.
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- Checks whether a group is public.
-- SECURITY DEFINER bypasses groups RLS, breaking the circular reference.
CREATE OR REPLACE FUNCTION public.is_group_public(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id AND visibility = 'public'
  );
$$;
```

**Expected result:** `Success. No rows returned` — both functions appear in **Database → Functions**.

Enable RLS on all tables first, then add policies.

```sql
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_records ENABLE ROW LEVEL SECURITY;
```

**Expected result:** `Success. No rows returned` — all six `ALTER TABLE` statements succeed. You can verify by going to **Database → Tables**, clicking any table, then checking **RLS enabled** in the table’s settings panel.

#### 5a — profiles policies

```sql
-- Any authenticated user can read any profile.
-- Rationale: nicknames must be visible to display "added by" and member lists.
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- A user can only insert their own profile row.
-- Rationale: the trigger handle_new_user() creates this automatically, but this
-- policy prevents manual INSERT of someone else's profile via the API.
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- A user can only update their own profile.
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

**Expected result:** `Success. No rows returned` — three policies appear under **Authentication → Policies → profiles**.

#### 5b — subscriptions policies

```sql
-- A user can only read their own subscription.
CREATE POLICY "Users can read their own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT, UPDATE, or DELETE via the API — all subscription mutations go through
-- service-role operations or database triggers only.
-- (No permissive policies = all mutations blocked for authenticated role.)
```

**Expected result:** `Success. No rows returned` — one policy appears under **Authentication → Policies → subscriptions**. No INSERT/UPDATE/DELETE policies exist on this table by design.

#### 5c — groups policies

```sql
-- Members can always see their own groups.
-- Non-members can see public groups (for the discovery page and public profiles).
-- Uses is_group_member() (SECURITY DEFINER) to avoid recursive RLS evaluation.
CREATE POLICY "Members see their groups; anyone sees public groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR public.is_group_member(id, auth.uid())
  );

-- Any authenticated user can create a group, subject to their plan's limit.
CREATE POLICY "Authenticated users can create groups within plan limits"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.can_create_group(auth.uid())
  );

-- Only the group owner can update group settings.
CREATE POLICY "Only the owner can update group settings"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Only the group owner can delete the group.
CREATE POLICY "Only the owner can delete the group"
  ON public.groups FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
```

**Expected result:** `Success. No rows returned` — four policies appear under **Authentication → Policies → groups**.

#### 5d — group_members policies

```sql
-- Members can see the member list of their own groups.
-- Non-members can see the member list of public groups.
-- Uses is_group_public() and is_group_member() (both SECURITY DEFINER) to avoid
-- the circular reference: group_members policy → groups → group_members → …
CREATE POLICY "Members see group_members for their groups; anyone sees public group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    public.is_group_public(group_id)
    OR public.is_group_member(group_id, auth.uid())
  );

-- Any authenticated user can join a public group (self-insert as member),
-- subject to their plan's total membership limit.
CREATE POLICY "Users can join public groups within plan limits"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_join_group(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.visibility = 'public'
    )
  );

-- A group owner can update member roles within their group.
CREATE POLICY "Group owner can update member roles"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'owner'
    )
  );

-- A group owner can remove members. A user can also remove themselves (leave group).
CREATE POLICY "Owner can remove members; users can leave"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'owner'
    )
  );
```

**Expected result:** `Success. No rows returned` — four policies appear under **Authentication → Policies → group_members**.

#### 5e — media_items policies

```sql
-- Group members can see items in their groups.
-- Non-members can see items in public groups (read-only — no insert/update/delete policy follows).
CREATE POLICY "Members see their group items; non-members see public group items"
  ON public.media_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
      AND (
        g.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        )
      )
    )
  );

-- Only group members (any role) can add items.
-- added_by is set to the current user's ID automatically.
CREATE POLICY "Group members can add items"
  ON public.media_items FOR INSERT
  TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
    )
  );

-- Group members can update item metadata, status, genre — but NOT added_by.
-- The added_by column is protected by a separate check below.
CREATE POLICY "Group members can update items"
  ON public.media_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Enforce added_by immutability: the new value must equal the old value.
    -- This prevents any UPDATE from changing who originally added the item,
    -- even if the request comes directly through the PostgREST API.
    added_by = (SELECT added_by FROM public.media_items WHERE id = media_items.id)
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
    )
  );

-- The item creator or the group owner can delete an item.
CREATE POLICY "Item creator or group owner can delete items"
  ON public.media_items FOR DELETE
  TO authenticated
  USING (
    added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'owner'
    )
  );
```

**Expected result:** `Success. No rows returned` — four policies appear under **Authentication → Policies → media_items**.

#### 5f — consumption_records policies

```sql
-- Group members can read all consumption records for items in their groups.
-- Non-members can read consumption records for items in public groups.
CREATE POLICY "Members see consumption records in their groups"
  ON public.consumption_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.media_items mi
      JOIN public.groups g ON g.id = mi.group_id
      WHERE mi.id = media_item_id
      AND (
        g.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        )
      )
    )
  );

-- A user can only insert their own consumption record, and only for items in groups they belong to.
CREATE POLICY "Users can mark items as consumed"
  ON public.consumption_records FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.media_items mi
      JOIN public.group_members gm ON gm.group_id = mi.group_id
      WHERE mi.id = media_item_id AND gm.user_id = auth.uid()
    )
  );

-- A user can only update their own consumption record (e.g., editing the note).
CREATE POLICY "Users can update their own consumption records"
  ON public.consumption_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- A user can only delete their own consumption record (un-mark as consumed).
CREATE POLICY "Users can delete their own consumption records"
  ON public.consumption_records FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

**Expected result:** `Success. No rows returned` — four policies appear under **Authentication → Policies → consumption_records**.

All five steps are now complete. Proceed to [Section 4 — Auth Configuration](#4-auth-configuration) to finish the setup, then run the verification queries in [Section 6](#6-verifying-the-setup) to confirm everything is correct before starting development.

---

## 4. Auth Configuration

### Enable Email Provider

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Ensure **Email** is enabled (it is on by default).
3. Disable **Confirm email** during development if you want to skip the verification step. Re-enable it for production.

### Password Security

1. Go to **Authentication → Settings → Password and security**.
2. Enable **Check for leaked passwords** — this checks passwords against HaveIBeenPwned.org on signup and login.
3. Set **Minimum password length** to at least `8`.

### Redirect URLs

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to `http://localhost:3000` for development (or your production URL for prod).
3. Add the following to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback` (when ready)

### Registration: Passing the Nickname

The nickname must be included in the `signUp` call's `options.data` object so the database trigger can read it:

```typescript
// In the registration server action or component:
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      nickname, // This is stored in auth.users.raw_user_meta_data
    },
  },
});
```

The trigger `handle_new_user()` reads `raw_user_meta_data ->> 'nickname'` and inserts the profile row automatically.

### Nickname Uniqueness Pre-check

Before calling `signUp`, check that the requested nickname is available:

```typescript
const { data, error } = await supabase
  .from("profiles")
  .select("id")
  .eq("nickname", nickname)
  .maybeSingle();

if (data) {
  // Nickname is already taken — return an error to the user
}
```

### Password Reset Flow

Supabase handles the reset email automatically. Call `resetPasswordForEmail` from the client:

```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
});
```

The `/reset-password` page listens for the `PASSWORD_RECOVERY` event and calls `updateUser` to set the new password.

---

## 5. Free Tier Optimisation

### Supabase Free Tier Limits (as of 2025)

| Resource                   | Free limit                  |
| -------------------------- | --------------------------- |
| Database size              | 500 MB                      |
| Monthly active users (MAU) | 50,000                      |
| API requests               | 500,000 / month             |
| Realtime connections       | 200 concurrent              |
| Storage                    | 1 GB                        |
| Edge Functions             | 500,000 invocations / month |

### How This Codebase Minimises Consumption

**Explicit column selection.** Every Supabase query must list exact columns rather than using `select('*')`. This reduces payload size and the bandwidth counted toward the API quota. Example:

```typescript
// ✅ Correct
const { data } = await supabase
  .from("groups")
  .select("id, name, visibility, created_at");

// ❌ Wrong — fetches unused columns, wastes bandwidth
const { data } = await supabase.from("groups").select("*");
```

**Nested selects over multiple round-trips.** Supabase supports embedding related tables in a single query. Use this instead of fetching parent and child records separately:

```typescript
// ✅ One query fetches group + member count + item count
const { data } = await supabase
  .from("groups")
  .select("id, name, visibility, group_members(count), media_items(count)");
```

**No polling.** The application never uses `setInterval` to re-fetch data. Updates are triggered by user actions (optimistic updates) or explicit manual refresh.

**No Realtime subscriptions.** Realtime connections consume resources continuously. None are used in the initial version. If added in future, document the reason explicitly in code comments and this file.

**Server Components for initial data load.** Pages that display data use Next.js Server Components to fetch on the server, avoiding a client-side fetch on page load.

**Zustand for stable UI state only.** Zustand is used only for ephemeral UI state (open dialogs, active tabs, filter state). It must not be used as a client-side cache for server data — that would create stale-data problems.

### Watching for Growth

As usage grows, the first limits to watch are:

1. **API requests** — Monitor in Dashboard → Reports → API. The biggest contributor will be media item fetches on group detail pages.
2. **Database size** — The JSONB `metadata` column is the most variable-size column. Monitor table sizes in Dashboard → Database → Tables.
3. **Realtime connections** — Currently zero, but any future addition must be carefully considered.

---

## 6. Verifying the Setup

After running all migrations, verify the setup is correct by running these checks in the SQL Editor:

```sql
-- 1. All enum types exist
SELECT typname FROM pg_type WHERE typname IN (
  'media_type', 'item_status', 'group_visibility', 'group_role',
  'subscription_plan', 'subscription_status'
);

-- 2. All tables exist with correct column counts
SELECT table_name, COUNT(column_name) AS col_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'subscriptions', 'groups', 'group_members', 'media_items', 'consumption_records')
GROUP BY table_name
ORDER BY table_name;

-- 3. RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'subscriptions', 'groups', 'group_members', 'media_items', 'consumption_records');

-- 4. All triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- 5. Test the can_create_group function with a dummy UUID (should return false since no subscription exists)
-- SELECT public.can_create_group('00000000-0000-0000-0000-000000000000');
```

All checks should pass before proceeding with application development.
