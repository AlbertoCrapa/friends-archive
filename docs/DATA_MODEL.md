# Data Model — The Friend Archive

This document is the authoritative reference for the database schema of The Friend Archive. It describes every table, every column, every constraint, every relationship, every index, and every Row Level Security policy. It also explains the reasoning behind design decisions that may not be obvious.

---

## Table of Contents

1. [Entity Overview](#1-entity-overview)
2. [Enum Types](#2-enum-types)
3. [Table Definitions](#3-table-definitions)
   - [profiles](#31-profiles)
   - [subscriptions](#32-subscriptions)
   - [groups](#33-groups)
   - [group_members](#34-group_members)
   - [media_items](#35-media_items)
   - [consumption_records](#36-consumption_records)
   - [group_join_requests](#37-group_join_requests)
   - [comments](#38-comments)
   - [item_statuses](#39-item_statuses)
4. [Relationships and Foreign Keys](#4-relationships-and-foreign-keys)
5. [Indexes](#5-indexes)
6. [Design Rationale](#6-design-rationale)
   - [Why JSONB for metadata](#61-why-jsonb-for-metadata)
   - [Why a separate consumption_records table](#62-why-a-separate-consumption_records-table)
   - [Why profiles is separate from auth.users](#63-why-profiles-is-separate-from-authusers)
   - [Why item_status is three values not six](#64-why-item_status-is-three-values-not-six)
   - [Why added_by is immutable](#65-why-added_by-is-immutable)
   - [Why joining requires an approved request](#66-why-joining-requires-an-approved-request)
   - [Why comments are a separate table](#68-why-comments-are-a-separate-table)
   - [Why status is per-member](#69-why-status-is-per-member)
7. [Row Level Security Matrix](#7-row-level-security-matrix)
8. [Metadata Field Reference](#8-metadata-field-reference)

---

## 1. Entity Overview

```
auth.users (Supabase managed)
    │
    │ 1:1
    ▼
profiles ──────────────────────────────────────────────┐
    │                                                   │
    │ 1:1                           1:many              │
    ▼                               (owner)             │
subscriptions                                           │
                                    groups ◄────────────┘
                                       │
                     ┌─────────────────┼─────────────────┐
                     │                 │                 │
                  1:many            1:many            1:many
                     │                 │                 │
                     ▼                 ▼                 ▼
              group_members   group_join_requests   media_items
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                 1:many              1:many              1:many
                                    │                   │                   │
                                    ▼                   ▼                   ▼
                          consumption_records     item_statuses         comments
```

The nine tables form three logical layers:

1. **Identity layer** — `profiles`, `subscriptions`
2. **Organisation layer** — `groups`, `group_members`, `group_join_requests`
3. **Content layer** — `media_items`, `item_statuses`, `consumption_records`, `comments`

---

## 2. Enum Types

### `media_type`

The four media categories supported by the application.

```sql
CREATE TYPE media_type AS ENUM ('movie', 'tv_series', 'book', 'video_game');
```

| Value        | UI label  |
| ------------ | --------- |
| `movie`      | Movies    |
| `tv_series`  | TV Series |
| `book`       | Books     |
| `video_game` | Games     |

> **Critical:** The value `movie` is the only acceptable identifier for cinema content in the entire codebase. The word "film" or "films" must not appear anywhere.

---

### `item_status`

The **per-member** progress state for a media item. Stored in the `item_statuses` table — one row per (item, user) — **never** on the shared `media_items` row.

```sql
CREATE TYPE item_status AS ENUM ('plan_to_consume', 'consuming', 'completed');
```

| Value             | UI label (every media type) |
| ----------------- | --------------------------- |
| `plan_to_consume` | Planned                     |
| `consuming`       | In progress                 |
| `completed`       | Completed                   |

The UI uses **one uniform vocabulary** — Planned / In progress / Completed — for all four media types, in every surface: the status filter pills, the status dropdown selectors, and the read-only badges. The database stores only the three enum values (`getStatusLabel()` in `types/index.ts` maps them).

UI behavior rules:

- Each member sees and edits **only their own** status for an item. Changing it never affects any other member.
- A missing `item_statuses` row means `plan_to_consume` — new items and new members start as "Planned" with no writes needed.
- When the current user sets status to `completed`, the app automatically creates/keeps their `consumption_records` row for that item.
- When the current user sets status to `plan_to_consume` or `consuming`, the app removes their `consumption_records` row for that item.
- The `Consumed By` text is derived from `consumption_records` (with the current user's status reflected immediately in UI) and is not manually edited in the table row.
- When **every current member** of the group has completed an item, the UI shows a small star next to the item's title ("Completed by everyone in the group").

---

### `group_visibility`

```sql
CREATE TYPE group_visibility AS ENUM ('public', 'private');
```

| Value     | Behaviour                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public`  | Listed on the Discover page. Non-members can read the content (items, members, consumption records) in read-only mode. Becoming a member requires an approved join request.       |
| `private` | Never listed on the Discover page. Non-members opening the group's link see only the group name and a blocked page with a "request access" button — the content is members-only. |

> **Joining is identical for both visibilities:** a user requests access, the owner is notified and approves or declines. Visibility controls only *discoverability* and whether non-members can *read* the content — never how membership is granted. See [§ 6.6](#66-why-joining-requires-an-approved-request).

---

### `group_role`

```sql
CREATE TYPE group_role AS ENUM ('owner', 'member');
```

| Value    | Permissions                                                 |
| -------- | ----------------------------------------------------------- |
| `owner`  | Full control: change settings, remove members, delete group |
| `member` | Add/edit items, mark consumption, write personal notes      |

There are exactly two roles. There is no moderator, admin, or co-owner role.

---

### `join_request_status`

```sql
CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'declined');
```

| Value      | Meaning                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `pending`  | Waiting for the group owner. Shown in the owner's notification bell and on the settings page.    |
| `approved` | The owner accepted; a `group_members` row was created in the same transaction.                   |
| `declined` | The owner refused. The requester may ask again — the same row flips back to `pending`.           |

---

### `subscription_plan`

```sql
CREATE TYPE subscription_plan AS ENUM ('free', 'premium', 'enterprise');
```

| Value        | Max groups owned | Max total memberships |
| ------------ | ---------------- | --------------------- |
| `free`       | 2                | 5                     |
| `premium`    | 10               | Unlimited             |
| `enterprise` | Unlimited        | Unlimited             |

---

### `subscription_status`

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trialing');
```

| Value       | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `active`    | Plan limits are in full effect                           |
| `cancelled` | User cancelled; plan may still be active until `ends_at` |
| `expired`   | Plan period ended; user is effectively on free behaviour |
| `trialing`  | Future use — not currently assigned                      |

---

## 3. Table Definitions

### 3.1 `profiles`

Public user profile. One row per registered user, created automatically by the `handle_new_user` trigger when a new `auth.users` row is inserted.

| Column       | Type          | Nullable | Default | Description                                                |
| ------------ | ------------- | -------- | ------- | ---------------------------------------------------------- |
| `id`         | `UUID`        | NOT NULL | —       | Primary key. Equals `auth.users.id`.                       |
| `nickname`   | `TEXT`        | NOT NULL | —       | Unique public display name. 2–30 chars, `[a-zA-Z0-9_\-]+`. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Row creation time.                                         |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last updated. Maintained by trigger.                       |

**Constraints:**

| Name                    | Type        | Expression                               |
| ----------------------- | ----------- | ---------------------------------------- |
| `profiles_pkey`         | PRIMARY KEY | `id`                                     |
| `profiles_nickname_key` | UNIQUE      | `nickname`                               |
| `nickname_length`       | CHECK       | `char_length(nickname) BETWEEN 2 AND 30` |
| `nickname_format`       | CHECK       | `nickname ~ '^[a-zA-Z0-9_\-]+$'`         |

**Foreign keys:**

| Column | References                         |
| ------ | ---------------------------------- |
| `id`   | `auth.users(id) ON DELETE CASCADE` |

---

### 3.2 `subscriptions`

One row per user. Tracks which plan they are on and the lifecycle status of that subscription. Created automatically by the `handle_new_user` trigger (plan = `free`, status = `active`).

| Column       | Type                  | Nullable | Default             | Description                                              |
| ------------ | --------------------- | -------- | ------------------- | -------------------------------------------------------- |
| `id`         | `UUID`                | NOT NULL | `gen_random_uuid()` | Primary key.                                             |
| `user_id`    | `UUID`                | NOT NULL | —                   | FK to `profiles.id`. Unique — one subscription per user. |
| `plan`       | `subscription_plan`   | NOT NULL | `'free'`            | Current plan.                                            |
| `status`     | `subscription_status` | NOT NULL | `'active'`          | Lifecycle status.                                        |
| `started_at` | `TIMESTAMPTZ`         | NOT NULL | `NOW()`             | When this plan period started.                           |
| `ends_at`    | `TIMESTAMPTZ`         | NULL     | `NULL`              | When the plan period ends. NULL = no expiry.             |
| `created_at` | `TIMESTAMPTZ`         | NOT NULL | `NOW()`             | Row creation time.                                       |
| `updated_at` | `TIMESTAMPTZ`         | NOT NULL | `NOW()`             | Last updated.                                            |

**Constraints:**

| Name                        | Type        | Expression |
| --------------------------- | ----------- | ---------- |
| `subscriptions_pkey`        | PRIMARY KEY | `id`       |
| `subscriptions_user_id_key` | UNIQUE      | `user_id`  |

**Foreign keys:**

| Column    | References                       |
| --------- | -------------------------------- |
| `user_id` | `profiles(id) ON DELETE CASCADE` |

---

### 3.3 `groups`

A collaborative media-tracking group. Has exactly one owner. The owner is also recorded in `group_members` with role = `owner` (inserted by trigger on group creation).

| Column        | Type               | Nullable | Default             | Description                                       |
| ------------- | ------------------ | -------- | ------------------- | ------------------------------------------------- |
| `id`          | `UUID`             | NOT NULL | `gen_random_uuid()` | Primary key.                                      |
| `name`        | `TEXT`             | NOT NULL | —                   | Group display name. 1–100 chars.                  |
| `description` | `TEXT`             | NULL     | `NULL`              | Optional description. Max 500 chars.              |
| `visibility`  | `group_visibility` | NOT NULL | `'private'`         | Discoverability setting.                          |
| `owner_id`    | `UUID`             | NOT NULL | —                   | FK to `profiles.id`. The user who owns the group. |
| `created_at`  | `TIMESTAMPTZ`      | NOT NULL | `NOW()`             | Row creation time.                                |
| `updated_at`  | `TIMESTAMPTZ`      | NOT NULL | `NOW()`             | Last updated.                                     |

**Constraints:**

| Name                       | Type        | Expression                                               |
| -------------------------- | ----------- | -------------------------------------------------------- |
| `groups_pkey`              | PRIMARY KEY | `id`                                                     |
| `group_name_length`        | CHECK       | `char_length(name) BETWEEN 1 AND 100`                    |
| `group_description_length` | CHECK       | `description IS NULL OR char_length(description) <= 500` |

**Foreign keys:**

| Column     | References                        |
| ---------- | --------------------------------- |
| `owner_id` | `profiles(id) ON DELETE RESTRICT` |

> `ON DELETE RESTRICT` on `owner_id` prevents deleting a profile that still owns a group. The owner must delete their groups or transfer ownership first.

---

### 3.4 `group_members`

Junction table. One row per (group, user) pair. Records the user's role and when they joined. The group owner is inserted here automatically by the `handle_new_group` trigger when the group is created.

| Column      | Type          | Nullable | Default             | Description                    |
| ----------- | ------------- | -------- | ------------------- | ------------------------------ |
| `id`        | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key.                   |
| `group_id`  | `UUID`        | NOT NULL | —                   | FK to `groups.id`.             |
| `user_id`   | `UUID`        | NOT NULL | —                   | FK to `profiles.id`.           |
| `role`      | `group_role`  | NOT NULL | `'member'`          | The user's role in this group. |
| `joined_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | When the user joined.          |

**Constraints:**

| Name                  | Type        | Expression            |
| --------------------- | ----------- | --------------------- |
| `group_members_pkey`  | PRIMARY KEY | `id`                  |
| `unique_group_member` | UNIQUE      | `(group_id, user_id)` |

**Foreign keys:**

| Column     | References                       |
| ---------- | -------------------------------- |
| `group_id` | `groups(id) ON DELETE CASCADE`   |
| `user_id`  | `profiles(id) ON DELETE CASCADE` |

---

### 3.5 `media_items`

A single media item within a group. The `type` field determines which keys are meaningful in the `metadata` JSONB column. See § 8 for the per-type metadata specification.

> **No status column.** Progress status is per-member and lives in `item_statuses` (§ 3.9). Everything on this row is shared by the whole group.

| Column       | Type          | Nullable | Default             | Description                                                   |
| ------------ | ------------- | -------- | ------------------- | ------------------------------------------------------------- |
| `id`         | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key.                                                  |
| `group_id`   | `UUID`        | NOT NULL | —                   | FK to `groups.id`. The group this item belongs to.            |
| `title`      | `TEXT`        | NOT NULL | —                   | Display title. 1–500 chars.                                   |
| `type`       | `media_type`  | NOT NULL | —                   | One of: `movie`, `tv_series`, `book`, `video_game`.           |
| `genre`      | `TEXT`        | NULL     | `NULL`              | Comma-separated **tag list** (genres + enrichment/user tags, e.g. `Action, Anime, Co-op`). Max 255 chars. Legacy column name; semantically the item's tag set. |
| `added_by`   | `UUID`        | NOT NULL | —                   | FK to `profiles.id`. Set server-side; immutable after insert. |
| `metadata`   | `JSONB`       | NOT NULL | `'{}'`              | Type-specific fields. Schema varies by `type`.                |
| `external_id`     | `TEXT`   | NULL     | `NULL`              | Namespaced provider-stable id (e.g. `tmdb:movie:693134`). Identical across all groups for the same work. NULL = manual entry. |
| `external_source` | `TEXT`   | NULL     | `NULL`              | Originating provider: `tmdb` \| `openlibrary` \| `rawg`. Set together with `external_id`. |
| `external_url`    | `TEXT`   | NULL     | `NULL`              | Cached external detail page for the work. NULL = manual entry. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Row creation time.                                            |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Last updated.                                                 |

**Constraints:**

| Name               | Type        | Expression                                   |
| ------------------ | ----------- | -------------------------------------------- |
| `media_items_pkey`       | PRIMARY KEY | `id`                                                 |
| `title_length`           | CHECK       | `char_length(title) BETWEEN 1 AND 500`               |
| `genre_length`           | CHECK       | `genre IS NULL OR char_length(genre) <= 255`         |
| `external_source_valid`  | CHECK       | `external_source IS NULL OR external_source IN ('tmdb','openlibrary','rawg')` |
| `external_id_with_source`| CHECK       | `(external_id IS NULL) = (external_source IS NULL)`   |

**Foreign keys:**

| Column     | References                        |
| ---------- | --------------------------------- |
| `group_id` | `groups(id) ON DELETE CASCADE`    |
| `added_by` | `profiles(id) ON DELETE RESTRICT` |

> `ON DELETE RESTRICT` on `added_by` prevents deleting a profile that has added items. Items must be deleted first (or ownership transferred in a future feature).

---

### 3.6 `consumption_records`

Tracks per-user consumption of a specific item. One row per (user, item) pair. Allows each member to independently mark any item as consumed and optionally attach a personal note.

| Column          | Type          | Nullable | Default             | Description                                         |
| --------------- | ------------- | -------- | ------------------- | --------------------------------------------------- |
| `id`            | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key.                                        |
| `media_item_id` | `UUID`        | NOT NULL | —                   | FK to `media_items.id`.                             |
| `user_id`       | `UUID`        | NOT NULL | —                   | FK to `profiles.id`.                                |
| `consumed_at`   | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | When the user marked this as consumed.              |
| `note`          | `TEXT`        | NULL     | `NULL`              | Personal note. Max 500 chars. Per-user, not shared. |
| `created_at`    | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Row creation time.                                  |
| `updated_at`    | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Last updated.                                       |

**Constraints:**

| Name                       | Type        | Expression                                 |
| -------------------------- | ----------- | ------------------------------------------ |
| `consumption_records_pkey` | PRIMARY KEY | `id`                                       |
| `unique_consumption`       | UNIQUE      | `(media_item_id, user_id)`                 |
| `note_length`              | CHECK       | `note IS NULL OR char_length(note) <= 500` |

**Foreign keys:**

| Column          | References                          |
| --------------- | ----------------------------------- |
| `media_item_id` | `media_items(id) ON DELETE CASCADE` |
| `user_id`       | `profiles(id) ON DELETE CASCADE`    |

---

### 3.7 `group_join_requests`

An access request from a user to a group. One row per (group, user) pair for the whole lifecycle: the row is created as `pending`, resolved to `approved` or `declined` by the owner, and a declined row is re-opened (set back to `pending`) if the user asks again.

| Column        | Type                  | Nullable | Default             | Description                                                  |
| ------------- | --------------------- | -------- | ------------------- | ------------------------------------------------------------ |
| `id`          | `UUID`                | NOT NULL | `gen_random_uuid()` | Primary key.                                                 |
| `group_id`    | `UUID`                | NOT NULL | —                   | FK to `groups.id`. The group being requested.                |
| `user_id`     | `UUID`                | NOT NULL | —                   | FK to `profiles.id`. The requester.                          |
| `status`      | `join_request_status` | NOT NULL | `'pending'`         | Lifecycle state.                                             |
| `resolved_at` | `TIMESTAMPTZ`         | NULL     | `NULL`              | When the owner approved/declined. NULL while pending.        |
| `resolved_by` | `UUID`                | NULL     | `NULL`              | FK to `profiles.id`. The owner who resolved it.              |
| `created_at`  | `TIMESTAMPTZ`         | NOT NULL | `NOW()`             | When the request was (last) made. Reset on re-request.       |
| `updated_at`  | `TIMESTAMPTZ`         | NOT NULL | `NOW()`             | Last updated. Maintained by trigger.                         |

**Constraints:**

| Name                       | Type        | Expression            |
| -------------------------- | ----------- | --------------------- |
| `group_join_requests_pkey` | PRIMARY KEY | `id`                  |
| `unique_join_request`      | UNIQUE      | `(group_id, user_id)` |

**Foreign keys:**

| Column        | References                        |
| ------------- | --------------------------------- |
| `group_id`    | `groups(id) ON DELETE CASCADE`    |
| `user_id`     | `profiles(id) ON DELETE CASCADE`  |
| `resolved_by` | `profiles(id) ON DELETE SET NULL` |

> **All writes go through RPCs.** There are no INSERT/UPDATE/DELETE RLS policies on this table. The four `SECURITY DEFINER` functions — `request_group_access`, `cancel_join_request`, `approve_join_request`, `decline_join_request` — are the only write path. See § 6.6.

> **PostgREST note:** this table has two FKs to `profiles` (`user_id` and `resolved_by`), so embedded selects must disambiguate: `profiles!group_join_requests_user_id_fkey(nickname)`.

---

### 3.8 `comments`

Per-item discussion. One row per comment written by a group member on a single `media_items` row. Comments are deliberately **not** stored on `media_items` — an item can carry many comments from many authors, each with its own text and timestamps. The author's name is **not** stored here; it is derived by joining `author_id` → `profiles.nickname`, exactly like `media_items.added_by`.

| Column          | Type          | Nullable | Default             | Description                                                       |
| --------------- | ------------- | -------- | ------------------- | ----------------------------------------------------------------- |
| `id`            | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key.                                                      |
| `media_item_id` | `UUID`        | NOT NULL | —                   | FK to `media_items.id`. The item the comment is attached to.      |
| `author_id`     | `UUID`        | NOT NULL | —                   | FK to `profiles.id`. Who wrote it. Join for the nickname/name.    |
| `body`          | `TEXT`        | NOT NULL | —                   | Comment text. 1–2000 chars.                                       |
| `created_at`    | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Row creation time.                                                |
| `updated_at`    | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Last updated. Maintained by trigger.                              |

**Constraints:**

| Name                  | Type        | Expression                                  |
| --------------------- | ----------- | ------------------------------------------- |
| `comments_pkey`       | PRIMARY KEY | `id`                                        |
| `comment_body_length` | CHECK       | `char_length(body) BETWEEN 1 AND 2000`      |

**Foreign keys:**

| Column          | References                          |
| --------------- | ----------------------------------- |
| `media_item_id` | `media_items(id) ON DELETE CASCADE` |
| `author_id`     | `profiles(id) ON DELETE CASCADE`    |

> **Read access mirrors the item.** A comment is readable by anyone who can read the parent group's content: group members for any group, plus any authenticated user for items in a **public** group (read-only). Writing requires membership. See [§ 6.8](#68-why-comments-are-a-separate-table) and the RLS matrix in [§ 7](#comments).

> **Note vs comment.** A `consumption_records.note` is the author's *private* per-item note (one per user/item). A `comments` row is a *shared* message visible to everyone who can read the group — many per item, threaded by `created_at`.

---

### 3.9 `item_statuses`

**Per-member progress status** for a media item. One row per (item, user) pair. This is where an item's status lives — the shared `media_items` row carries no status at all, so every member of a group tracks the same shared item independently.

**A missing row means `plan_to_consume`** ("Planned"). The app therefore only writes a row when a member's status actually diverges from the default, and new members automatically see every item as "Planned" without any backfill.

| Column          | Type          | Nullable | Default             | Description                                            |
| --------------- | ------------- | -------- | ------------------- | ------------------------------------------------------ |
| `id`            | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key.                                           |
| `media_item_id` | `UUID`        | NOT NULL | —                   | FK to `media_items.id`.                                |
| `user_id`       | `UUID`        | NOT NULL | —                   | FK to `profiles.id`. Whose status this is.             |
| `status`        | `item_status` | NOT NULL | `'plan_to_consume'` | The member's own progress state.                       |
| `created_at`    | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Row creation time.                                     |
| `updated_at`    | `TIMESTAMPTZ` | NOT NULL | `NOW()`             | Last updated. Maintained by trigger.                   |

**Constraints:**

| Name                 | Type        | Expression                 |
| -------------------- | ----------- | -------------------------- |
| `item_statuses_pkey` | PRIMARY KEY | `id`                       |
| `unique_item_status` | UNIQUE      | `(media_item_id, user_id)` |

**Foreign keys:**

| Column          | References                          |
| --------------- | ----------------------------------- |
| `media_item_id` | `media_items(id) ON DELETE CASCADE` |
| `user_id`       | `profiles(id) ON DELETE CASCADE`    |

> **Read is group-wide, write is strictly personal.** Anyone who can read the group's content can read every member's status (same visibility rule as `consumption_records` — it feeds the "everyone completed" star and mirrors what `Consumed By` already reveals). But INSERT/UPDATE/DELETE are limited to `user_id = auth.uid()`: no member, not even the group owner, can change another member's status. See the RLS matrix in [§ 7](#item_statuses).

> **Status ⇄ consumption invariant.** The app keeps a member's `completed` status and their `consumption_records` row in lockstep: setting `completed` upserts the consumption row; leaving `completed` deletes it. Rows of users who later leave the group are kept (like consumption records) but ignored by the "everyone completed" star, which only counts **current** members.

---

## 4. Relationships and Foreign Keys

```
auth.users
└── profiles (id → auth.users.id, CASCADE)
    ├── subscriptions (user_id → profiles.id, CASCADE)
    ├── groups (owner_id → profiles.id, RESTRICT)
    │   ├── group_members (group_id → groups.id, CASCADE)
    │   │   └── [profiles.id → group_members.user_id, CASCADE]
    │   └── group_join_requests (group_id → groups.id, CASCADE)
    ├── group_members (user_id → profiles.id, CASCADE)
    ├── group_join_requests (user_id → profiles.id, CASCADE; resolved_by → profiles.id, SET NULL)
    ├── media_items (added_by → profiles.id, RESTRICT)
    │   ├── item_statuses (media_item_id → media_items.id, CASCADE)
    │   ├── consumption_records (media_item_id → media_items.id, CASCADE)
    │   └── comments (media_item_id → media_items.id, CASCADE)
    ├── item_statuses (user_id → profiles.id, CASCADE)
    ├── consumption_records (user_id → profiles.id, CASCADE)
    └── comments (author_id → profiles.id, CASCADE)
```

### Deletion Cascade Summary

| If you delete...  | Effect on...                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `auth.users` row  | Cascade deletes `profiles` row                                                                                                      |
| `profiles` row    | Cascade deletes `subscriptions`, `group_members`, `group_join_requests`, `item_statuses`, `consumption_records`, `comments`. Blocked (RESTRICT) if user owns groups or has added items. |
| `groups` row      | Cascade deletes `group_members`, `group_join_requests`, `media_items`                                                              |
| `media_items` row | Cascade deletes `item_statuses`, `consumption_records`, `comments`                                                                 |

---

## 5. Indexes

| Index name                              | Table                 | Columns         | Purpose                               |
| --------------------------------------- | --------------------- | --------------- | ------------------------------------- |
| `idx_profiles_nickname`                 | `profiles`            | `nickname`      | Profile page lookup by nickname       |
| `idx_subscriptions_user_id`             | `subscriptions`       | `user_id`       | Subscription lookup by user           |
| `idx_groups_owner_id`                   | `groups`              | `owner_id`      | Dashboard: "my groups" query          |
| `idx_groups_visibility`                 | `groups`              | `visibility`    | Discover page: public groups filter   |
| `idx_group_members_user_id`             | `group_members`       | `user_id`       | "Which groups does user X belong to?" |
| `idx_group_members_group_id`            | `group_members`       | `group_id`      | "Who are the members of group X?"     |
| `idx_group_join_requests_group_id`      | `group_join_requests` | `group_id`      | Owner reviewing a group's requests    |
| `idx_group_join_requests_user_id`       | `group_join_requests` | `user_id`       | "What has user X requested?"          |
| `idx_group_join_requests_status`        | `group_join_requests` | `status`        | Pending-request notification badge    |
| `idx_media_items_group_id`              | `media_items`         | `group_id`      | Group detail page: all items in group |
| `idx_media_items_type`                  | `media_items`         | `type`          | Type tab filtering                    |
| `idx_media_items_added_by`              | `media_items`         | `added_by`      | "Added by" filter                     |
| `idx_item_statuses_media_item_id`       | `item_statuses`       | `media_item_id` | "Who has which status for item X?"    |
| `idx_item_statuses_user_id`             | `item_statuses`       | `user_id`       | "User X's statuses" (group page, dashboard breakdown) |
| `idx_media_items_external_id`           | `media_items`         | `external_id`   | Future cross-group rollups (most-added works) |
| `idx_media_items_genre_trgm`            | `media_items`         | `genre` (GIN trigram) | Fast tag substring matching when filtering by tag |
| `idx_consumption_records_user_id`       | `consumption_records` | `user_id`       | "What has user X consumed?"           |
| `idx_consumption_records_media_item_id` | `consumption_records` | `media_item_id` | "Who has consumed item X?"            |
| `idx_comments_media_item_id`            | `comments`            | `media_item_id` | Load the comment thread for an item   |
| `idx_comments_author_id`                | `comments`            | `author_id`     | "What has user X written?" / cascade  |

No full-text search indexes are in scope for the initial version. If title search performance becomes an issue, add a GIN index with `to_tsvector` on `media_items.title`.

---

## 6. Design Rationale

### 6.1 Why JSONB for metadata

**The decision:** Type-specific fields for movies, TV series, books, and video games are stored in a single `JSONB` column called `metadata` on `media_items`, rather than in separate nullable columns or in separate joined tables.

**The alternatives considered:**

_Option A — Nullable columns:_  
Add individual columns like `director TEXT`, `author TEXT`, `developer TEXT`, `release_year INT`, etc. directly on `media_items`. Every row has most of these columns set to NULL.

Rejected because:

- Creates a wide table with many NULLs — wasteful and semantically noisy.
- Adding new type-specific fields requires a schema migration.
- More columns = larger row header overhead on Supabase's free-tier PostgreSQL.

_Option B — Separate type-specific tables:_  
Create `movie_details`, `tv_series_details`, `book_details`, `video_game_details` tables, each with a FK to `media_items`.

Rejected because:

- Every query for an item requires a JOIN to retrieve its metadata.
- N+1 queries become very likely on list pages.
- More tables = more RLS policies = more maintenance.

_Option C — JSONB column (chosen):_  
One `metadata JSONB` column stores the type-specific fields for each item. The application layer enforces the per-type schema.

Chosen because:

- No NULL sprawl. Each row contains only the fields relevant to its type.
- No JOIN required to fetch metadata — it is part of the same row.
- New fields can be added to a type without a database migration.
- Supabase's free tier has no penalty for JSONB that wouldn't also apply to nullable columns.
- Querying specific JSONB fields (e.g. `metadata->>'director'`) is efficient for the column selectivity of our queries.

**Trade-off accepted:** The database does not enforce the shape of `metadata`. The TypeScript types and application layer are responsible for ensuring the correct keys are set. This is acceptable because the four media types are well-defined and static.

---

### 6.2 Why a separate `consumption_records` table

**The decision:** Tracking which users have consumed an item uses a dedicated `consumption_records` table rather than an array column on `media_items`.

**The alternative:** Store `consumed_by UUID[]` on `media_items` as an array of user IDs.

Rejected because:

- Arrays on PostgreSQL do not support foreign key constraints — referential integrity cannot be enforced.
- Adding a per-user note to an array entry is not possible without denormalising further.
- Querying "has user X consumed item Y?" with an array requires `= ANY(consumed_by)`, which is harder to index and optimize than a simple indexed lookup on a junction table row.
- The `consumption_records` table can be extended in future (e.g. adding a rating, a watched-on date precision) without touching the items table.

Current UI linkage:

- A member's own status (in `item_statuses`) and their consumption are intentionally linked. Setting your status to `completed` marks you consumed; setting it away from `completed` removes your consumption row. Other members' rows are never touched.

---

### 6.3 Why `profiles` is separate from `auth.users`

**The decision:** User profile data (specifically the `nickname`) is stored in a public `profiles` table, not directly on `auth.users`.

**Why:** `auth.users` is managed by Supabase internally and exists in the `auth` schema, which is not directly accessible via PostgREST (the Supabase API layer). Storing public profile data in a public schema table allows:

- Other authenticated users to read nicknames for display purposes.
- RLS policies to control read access without touching Supabase internals.
- Profile data to be queried with Supabase's `.from('profiles')` syntax like any other table.

The `profiles.id` column is a foreign key to `auth.users.id`, maintaining a strict 1:1 relationship.

---

### 6.4 Why `item_status` is three values, not six

**The original system** used six string values: `Plan to Watch`, `Watching`, `Watched`, `Plan to Read`, `Reading`, `Read`.

**The problem:** These six values encode both the progress state and the media type in the same field. "Plan to Watch" and "Plan to Read" are semantically identical — the verb changes only because of the media type. This coupling makes filtering and querying awkward.

**The new design:** Three enum values (`plan_to_consume`, `consuming`, `completed`) represent the pure progress state, and the UI shows them with **one uniform vocabulary for every media type**: Planned / In progress / Completed. The same three labels appear in the filter pills, the status dropdowns and the read-only badges — no per-type verb variants anywhere.

```typescript
function getStatusLabel(status: ItemStatus): string {
  switch (status) {
    case "plan_to_consume": return "Planned";
    case "consuming":       return "In progress";
    case "completed":       return "Completed";
  }
}
```

This makes filtering by status work correctly across all types with a single condition, and keeps the vocabulary identical everywhere in the app.

---

### 6.5 Why `added_by` is immutable

**The decision:** The `added_by` column on `media_items` is set once on insert (to `auth.uid()`) and is protected by an RLS `WITH CHECK` condition that prevents any `UPDATE` from changing it.

**Why this matters:** Without this protection, a malicious or buggy client could claim ownership of an item they did not add, or strip attribution from items added by someone else. Immutability at the database level means this protection holds even if:

- A client calls the PostgREST API directly with a crafted `PATCH` request.
- A future developer forgets to exclude the `added_by` field from an edit form.
- A Supabase dashboard operator runs a manual UPDATE query as the authenticated user.

The exact RLS `WITH CHECK` clause is:

```sql
WITH CHECK (
  added_by = (SELECT added_by FROM public.media_items WHERE id = media_items.id)
  AND EXISTS ( ... member check ... )
)
```

This compares the proposed `added_by` value against the existing value in the database — they must be equal for the update to succeed. Service role operations can bypass this if truly needed for administrative purposes.

---

### 6.6 Why joining requires an approved request

**The decision:** Nobody can add themselves to a group. For **both** public and private groups, a user submits an access request (`group_join_requests`), the owner is notified, and membership is created only when the owner approves. Visibility (`public`/`private`) controls discoverability and whether non-members can read content — it does not change how membership is granted.

**The flow:**

```
user clicks "Request to join"
        │
        ▼
request_group_access(group_id)          ── creates/re-opens a 'pending' row
        │
        ▼
owner sees the request (notification bell, group settings)
        │
        ├── approve_join_request(id) ──► group_members row created,
        │                                request marked 'approved'
        └── decline_join_request(id) ──► request marked 'declined'
                                          (requester may ask again)
```

**Per-visibility behaviour for a non-member:**

| Situation                          | `public` group                          | `private` group                                  |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| Listed on Discover                 | ✅                                       | ✗                                                |
| Opens the group link               | Read-only view of the content            | Blocked page: group name + "request access" only |
| Sees items / members / records     | ✅ (read-only)                           | ✗                                                |
| Becomes a member                   | Request → owner approval                 | Request → owner approval                         |

**Why all mutations are `SECURITY DEFINER` RPCs instead of RLS policies:**

- Approving a request must atomically write to **two** tables (`group_members` insert + `group_join_requests` update). RLS policies cannot express a cross-table transaction; a function can.
- The plan-limit check (`can_join_group`) must run against the **requester's** subscription at approval time, not against the caller. A `WITH CHECK` clause only sees `auth.uid()` — the owner — so the check belongs in the function.
- One row per (group, user) with a re-openable `declined` state requires upsert logic (`ON CONFLICT ... DO UPDATE ... WHERE status <> 'pending'`) that would otherwise need both an INSERT and an UPDATE policy agreeing with each other.

**Why private group metadata is readable by all authenticated users:** the `groups` SELECT policy is `USING (true)`. This is deliberate — a private group's shared link must render a blocked page showing the group's *name* and a request button. Only metadata (name, description, visibility, owner) is exposed; `group_members`, `media_items`, and `consumption_records` all keep member-only policies for private groups. Treat private group names/descriptions accordingly: they are visible to anyone with an account who has the link.

**Notifications are derived, not stored:** there is no separate notifications table. The owner's notification bell is simply a query for `status = 'pending'` requests on groups they own; the requester's "pending / declined" states come from their own rows. The requester's **"accepted" notification** ("X accepted you, you're now part of the group") is likewise derived — a query for the requester's own rows with `status = 'approved'` and `resolved_at` within a recent time window (14 days), with `resolved_by` joined for the approver's nickname. Because there is no read/unread bookkeeping, the time window is what keeps the accepted list from growing forever. No extra writes, nothing to get out of sync.

---

### 6.7 Why an optional external identification layer

**The decision:** Each media item may carry a nullable `external_id` (plus
`external_source` and `external_url`) referencing a stable id from a trusted
external provider — TMDB for movies/TV, Open Library for books, RAWG for video
games. The value is **namespaced** (e.g. `tmdb:movie:693134`) so it is unique
across providers and **identical across all groups** for the same real-world work.

**Why not change the ownership model:** The app stays fully group-centric. Every
item still owns its internal `id` (UUID) and belongs to exactly one group. The
external layer is purely additive and optional — it links items that refer to the
same work without merging or de-duplicating any group's local rows.

**Why namespaced columns instead of just a number:** A bare provider id (e.g.
`693134`) is not globally unique — TMDB and RAWG ids can collide. Namespacing makes
one string self-describing and collision-free, which is exactly what future global
analytics need (`GROUP BY external_id`).

**Why separate columns instead of inside `metadata` JSONB:** identity is
cross-cutting and must be indexable for future global-discovery features, so it
earns real columns and an index. `metadata` stays the per-type display bag (now
*populated from* the provider when an item is linked, instead of only by hand).

**Why nullable / manual still works:** if no external match exists (or the provider
is unreachable), the user adds a manual entry exactly as before. All three columns
stay `NULL`, no external links render, and identical manual entries in different
groups remain independent and unlinked.

**Why not part of the `added_by` immutability rule:** unlike attribution, the
external link is correctable — a member can link a previously manual item, or unlink
a mis-linked one, from the edit dialog. It is an ordinary editable field. Normalized
provider abstraction and the search/autocomplete flow live in `lib/providers/` and
`app/api/external-search/`.

---

### 6.8 Why comments are a separate table

**The decision:** Discussion on a media item lives in a dedicated `comments` table keyed by `media_item_id`, not in a column on `media_items` and not in `consumption_records`.

**Why not a column on `media_items`:** A `JSONB[]` or text column on the item would have no per-comment identity, no per-comment author FK, no per-comment timestamps, and no way to apply row-level permissions to a single comment (edit/delete your own). Threaded discussion is inherently 1:many — one item, many comments by many people — which is a child table, not a field.

**Why not reuse `consumption_records.note`:** the `note` is **private** (one per user/item, the author's own reminder). A comment is **shared** — every member, and any viewer of a public group, reads it. Different audience, different cardinality (many comments per item), different lifecycle. Overloading `note` would conflate the two.

**Why the name is not stored:** `comments` stores only `author_id` (FK to `profiles`). The display name comes from a join to `profiles.nickname`, identical to how `media_items.added_by` is resolved. Storing the nickname inline would duplicate data and go stale if a user renames. "The id and name of who made the comment" = `author_id` + the joined `nickname`.

**Read access is inherited from the item, not stored on the comment:** the RLS SELECT policy walks `comment → media_items → groups` and allows a read when the group is public **or** the reader is a member — the exact same rule as `consumption_records`. So "other members of the group, or anyone who can read the group's content" get comments for free, with no per-comment visibility flag to keep in sync.

**Writing requires membership; moderation is owner-or-author:** only group members can post (non-members viewing a public group stay read-only). A comment can be edited only by its author, and deleted by its author **or** the group owner (basic moderation) — mirroring the `media_items` delete rule.

---

### 6.9 Why status is per-member

**The decision:** An item's progress status lives in the `item_statuses` table, one row per (item, user) — not on the shared `media_items` row.

**The problem with the old design:** `media_items.status` was a single shared field that any member could update. When one member marked *Dune* as completed, it flipped to "Completed" for the entire group — even for members who hadn't started it. Status is inherently personal progress, but the schema stored it as group state, so members constantly overwrote each other.

**Why a dedicated join table (and not the alternatives):**

- *A `status` column on `consumption_records`* was rejected because a consumption row's existence **means** "completed" — the UI and the `Consumed By` list depend on that. Planned/in-progress states would force rows whose presence no longer means anything, breaking that invariant and all existing queries.
- *An array/JSONB map on `media_items`* was rejected for the same reasons as `consumed_by UUID[]` (§ 6.2): no FK integrity, no per-entry timestamps, unindexable lookups, and RLS could not restrict writes to one member's entry — any member could still clobber everyone's status in a single UPDATE.
- *A join table* gives each status its own row, FK integrity, an `updated_at` audit trail, and — decisively — **row-level security**: `user_id = auth.uid()` on writes makes "you can only change your own status" a database guarantee instead of a UI convention.

**Why a missing row means `plan_to_consume`:** every member has a status for every item in their groups; materialising all of them would mean `members × items` rows that are almost all "Planned". Treating absence as the default keeps the table proportional to actual activity and makes new items and new members correct with zero writes.

**What stayed shared:** everything else on `media_items` (title, type, tags, metadata, external link) is still one row co-edited by the whole group, and `consumption_records` still records who finished what. The "everyone completed" star is derived in the UI: an item earns it when every **current** `group_members` row has a matching completion.

---

## 7. Row Level Security Matrix

For each table and operation, this matrix shows what is permitted for each actor type.

**Actor types:**

- **Anon** — Unauthenticated request (no session)
- **Auth / Non-member** — Authenticated user, not a member of the relevant group
- **Member** — Authenticated user who is a member of the group
- **Owner** — Authenticated user who owns the group (also a member in `group_members`)
- **Item creator** — Authenticated user who created the specific `media_items` row
- **Record owner** — Authenticated user who created the specific `consumption_records` row
- **Service role** — Server-side admin operation using `SUPABASE_SERVICE_ROLE_KEY`

### `profiles`

| Operation | Anon | Auth / Non-member          | Member        | Owner         | Service role |
| --------- | ---- | -------------------------- | ------------- | ------------- | ------------ |
| SELECT    | ✗    | ✅ (any profile)           | ✅            | ✅            | ✅           |
| INSERT    | ✗    | ✅ (own only, via trigger) | ✅            | ✅            | ✅           |
| UPDATE    | ✗    | ✅ (own only)              | ✅ (own only) | ✅ (own only) | ✅           |
| DELETE    | ✗    | ✗                          | ✗             | ✗             | ✅           |

### `subscriptions`

| Operation | Anon | Auth             | Service role |
| --------- | ---- | ---------------- | ------------ |
| SELECT    | ✗    | ✅ (own only)    | ✅           |
| INSERT    | ✗    | ✗ (trigger only) | ✅           |
| UPDATE    | ✗    | ✗                | ✅           |
| DELETE    | ✗    | ✗                | ✅           |

### `groups`

| Operation | Anon | Auth / Non-member      | Member                 | Owner                  | Service role |
| --------- | ---- | ---------------------- | ---------------------- | ---------------------- | ------------ |
| SELECT    | ✗    | ✅ (metadata, any group) | ✅                   | ✅                     | ✅           |
| INSERT    | ✗    | ✅ (within plan limit) | ✅ (within plan limit) | ✅ (within plan limit) | ✅           |
| UPDATE    | ✗    | ✗                      | ✗                      | ✅                     | ✅           |
| DELETE    | ✗    | ✗                      | ✗                      | ✅                     | ✅           |

> Group **metadata** (name, description, visibility, owner) is readable by any authenticated user — even for private groups — so a shared link can render the blocked page. Group **content** stays protected by the policies on `group_members`, `media_items`, and `consumption_records`. See § 6.6.

### `group_members`

| Operation              | Anon | Auth / Non-member | Member       | Owner        | Service role |
| ---------------------- | ---- | ----------------- | ------------ | ------------ | ------------ |
| SELECT (public group)  | ✗    | ✅                | ✅           | ✅           | ✅           |
| SELECT (private group) | ✗    | ✗                 | ✅           | ✅           | ✅           |
| INSERT                 | ✗    | ✗ (RPC only)      | ✗ (RPC only) | ✗ (RPC only) | ✅           |
| UPDATE (roles)         | ✗    | ✗                 | ✗            | ✅           | ✅           |
| DELETE (self-leave)    | ✗    | —                 | ✅ (own row) | ✅ (own row) | ✅           |
| DELETE (remove member) | ✗    | ✗                 | ✗            | ✅           | ✅           |

> There is **no INSERT policy** on `group_members`. Rows are created only by the `handle_new_group()` trigger (owner on creation) and the `approve_join_request()` function (approved requester) — both `SECURITY DEFINER`.

### `group_join_requests`

| Operation | Anon | Auth / Non-member            | Requester               | Group owner                  | Service role |
| --------- | ---- | ---------------------------- | ----------------------- | ---------------------------- | ------------ |
| SELECT    | ✗    | ✗                            | ✅ (own requests)       | ✅ (requests for own groups) | ✅           |
| INSERT    | ✗    | via `request_group_access()` | —                       | —                            | ✅           |
| UPDATE    | ✗    | ✗                            | ✗                       | via `approve/decline` RPCs   | ✅           |
| DELETE    | ✗    | ✗                            | via `cancel_join_request()` | ✗                        | ✅           |

### `media_items`

| Operation               | Anon | Auth / Non-member | Member | Owner | Item creator | Service role |
| ----------------------- | ---- | ----------------- | ------ | ----- | ------------ | ------------ |
| SELECT (public group)   | ✗    | ✅ (read-only)    | ✅     | ✅    | ✅           | ✅           |
| SELECT (private group)  | ✗    | ✗                 | ✅     | ✅    | ✅           | ✅           |
| INSERT                  | ✗    | ✗                 | ✅     | ✅    | ✅           | ✅           |
| UPDATE (excl. added_by) | ✗    | ✗                 | ✅     | ✅    | ✅           | ✅           |
| UPDATE (added_by)       | ✗    | ✗                 | ✗      | ✗     | ✗            | ✅           |
| DELETE                  | ✗    | ✗                 | ✗      | ✅    | ✅           | ✅           |

### `consumption_records`

| Operation              | Anon | Auth / Non-member | Member        | Owner         | Record owner | Service role |
| ---------------------- | ---- | ----------------- | ------------- | ------------- | ------------ | ------------ |
| SELECT (public group)  | ✗    | ✅                | ✅            | ✅            | ✅           | ✅           |
| SELECT (private group) | ✗    | ✗                 | ✅            | ✅            | ✅           | ✅           |
| INSERT (own record)    | ✗    | ✗                 | ✅            | ✅            | —            | ✅           |
| UPDATE (own record)    | ✗    | ✗                 | ✅ (own only) | ✅ (own only) | ✅           | ✅           |
| DELETE (own record)    | ✗    | ✗                 | ✅ (own only) | ✅ (own only) | ✅           | ✅           |

### `item_statuses`

- **Status owner** — Authenticated user whose `user_id` is on the specific `item_statuses` row.

| Operation              | Anon | Auth / Non-member | Member        | Owner         | Status owner | Service role |
| ---------------------- | ---- | ----------------- | ------------- | ------------- | ------------ | ------------ |
| SELECT (public group)  | ✗    | ✅                | ✅            | ✅            | ✅           | ✅           |
| SELECT (private group) | ✗    | ✗                 | ✅            | ✅            | ✅           | ✅           |
| INSERT (own status)    | ✗    | ✗                 | ✅            | ✅            | —            | ✅           |
| UPDATE (own status)    | ✗    | ✗                 | ✅ (own only) | ✅ (own only) | ✅           | ✅           |
| DELETE (own status)    | ✗    | ✗                 | ✅ (own only) | ✅ (own only) | ✅           | ✅           |

> Statuses are **readable group-wide** (same rule as `consumption_records`) but **writable only by their owner** — not even the group owner can change another member's status. `user_id = auth.uid()` is enforced on every write.

### `comments`

- **Author** — Authenticated user who wrote the specific `comments` row.

| Operation              | Anon | Auth / Non-member | Member        | Owner         | Author        | Service role |
| ---------------------- | ---- | ----------------- | ------------- | ------------- | ------------- | ------------ |
| SELECT (public group)  | ✗    | ✅ (read-only)    | ✅            | ✅            | ✅            | ✅           |
| SELECT (private group) | ✗    | ✗                 | ✅            | ✅            | ✅            | ✅           |
| INSERT (own comment)   | ✗    | ✗                 | ✅            | ✅            | —             | ✅           |
| UPDATE (own comment)   | ✗    | ✗                 | ✅ (own only) | ✅ (own only) | ✅            | ✅           |
| DELETE                 | ✗    | ✗                 | ✅ (own only) | ✅ (any in group) | ✅ (own)   | ✅           |

> `author_id` is set to `auth.uid()` on insert and cannot be reassigned on update (the UPDATE `WITH CHECK` requires `author_id = auth.uid()`). Delete is allowed for the comment's author or the group owner (moderation).

---

## 8. Metadata Field Reference

The `metadata` JSONB column on `media_items` stores different fields depending on `type`. All fields are optional — the UI shows fields as empty when not provided, and the database stores `{}` as the default.

### `movie`

```typescript
interface MovieMetadata {
  director?: string; // e.g. "Denis Villeneuve"
  release_year?: number; // e.g. 2021 (integer)
  duration_minutes?: number; // e.g. 155 (integer)
}
```

Example:

```json
{
  "director": "Denis Villeneuve",
  "release_year": 2021,
  "duration_minutes": 155
}
```

### `tv_series`

```typescript
interface TvSeriesMetadata {
  creator?: string; // e.g. "Christopher Storer"
  release_year?: number; // e.g. 2022 (integer, year of first episode)
  seasons?: number; // e.g. 3 (integer)
  platform?: string; // e.g. "Hulu", "Netflix", "Apple TV+"
}
```

Example:

```json
{
  "creator": "Christopher Storer",
  "release_year": 2022,
  "seasons": 3,
  "platform": "Hulu"
}
```

### `book`

```typescript
interface BookMetadata {
  author?: string; // e.g. "Andy Weir"
  publication_year?: number; // e.g. 2021 (integer)
  publisher?: string; // e.g. "Ballantine Books"
}
```

Example:

```json
{
  "author": "Andy Weir",
  "publication_year": 2021,
  "publisher": "Ballantine Books"
}
```

### `video_game`

```typescript
interface VideoGameMetadata {
  developer?: string; // e.g. "FromSoftware"
  publisher?: string; // e.g. "Bandai Namco"
  release_year?: number; // e.g. 2022 (integer)
  platforms?: string[]; // e.g. ["PC", "PS5", "Xbox Series X"]
}
```

Example:

```json
{
  "developer": "FromSoftware",
  "publisher": "Bandai Namco",
  "release_year": 2022,
  "platforms": ["PC", "PS5", "Xbox Series X"]
}
```

### TypeScript Union

In `types/index.ts`, the metadata types are expressed as a discriminated union:

```typescript
export type MovieMetadata = {
  director?: string;
  release_year?: number;
  duration_minutes?: number;
};

export type TvSeriesMetadata = {
  creator?: string;
  release_year?: number;
  seasons?: number;
  platform?: string;
};

export type BookMetadata = {
  author?: string;
  publication_year?: number;
  publisher?: string;
};

export type VideoGameMetadata = {
  developer?: string;
  publisher?: string;
  release_year?: number;
  platforms?: string[];
};

export type MediaMetadata =
  | MovieMetadata
  | TvSeriesMetadata
  | BookMetadata
  | VideoGameMetadata;
```

When reading `metadata` from Supabase, cast it to the appropriate type based on the item's `type` field.
