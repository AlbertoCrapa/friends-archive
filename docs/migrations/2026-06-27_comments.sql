-- ============================================================================
-- THE FRIEND ARCHIVE — Comments feature migration
--
-- Run this ENTIRE block in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- It is additive and idempotent: safe to run once on an existing database that
-- already has the schema from docs/SUPABASE_SETUP.md. It depends on the
-- profiles, groups, group_members and media_items tables and on the generic
-- handle_updated_at() trigger function (SUPABASE_SETUP.md Step 4a).
--
-- WHY A SEPARATE TABLE: comments are intentionally NOT stored on media_items.
-- A single item carries many comments from many people, each with its own
-- author and timestamps, so they live in their own table keyed by media_item_id.
-- The author's NAME is never duplicated here — it is always derived by joining
-- author_id → profiles.nickname (the same rule used for media_items.added_by).
-- Together, author_id and the joined nickname are the "id and name of who made
-- the comment".
--
-- WHO CAN READ: anyone who can read the parent group's content — i.e. group
-- members, plus any authenticated user for items in a PUBLIC group (read-only).
-- This mirrors the consumption_records visibility rule exactly.
-- ============================================================================


-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id  UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT comment_body_length CHECK (char_length(body) BETWEEN 1 AND 2000)
);

COMMENT ON TABLE public.comments IS
  'Per-item discussion. One row per comment. Readable by anyone who can read the parent group''s content (members, or any authenticated user for a public group). The author name is derived from author_id -> profiles.nickname, never stored here.';
COMMENT ON COLUMN public.comments.author_id IS
  'UUID of the profile who wrote the comment. Join to profiles for the nickname/name.';
COMMENT ON COLUMN public.comments.body IS
  'Comment text. 1-2000 chars (CHECK constraint).';


-- 2. Indexes -----------------------------------------------------------------
-- Fetch the whole thread under one media item.
CREATE INDEX IF NOT EXISTS idx_comments_media_item_id ON public.comments (media_item_id);
-- "What has user X written?" and cascade-friendly author lookups.
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments (author_id);


-- 3. updated_at trigger ------------------------------------------------------
-- Reuses the generic handle_updated_at() from SUPABASE_SETUP.md Step 4a.
DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 4. Row Level Security ------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- SELECT: same visibility as the parent item — group members see comments in
-- their groups; any authenticated user sees comments on items in a PUBLIC group
-- (read access to the group's content). Mirrors consumption_records SELECT.
DROP POLICY IF EXISTS "Members and public viewers can read comments" ON public.comments;
CREATE POLICY "Members and public viewers can read comments"
  ON public.comments FOR SELECT
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

-- INSERT: only a group MEMBER can comment, and only as themselves. Non-members
-- viewing a public group are read-only. Mirrors consumption_records INSERT.
DROP POLICY IF EXISTS "Group members can add comments" ON public.comments;
CREATE POLICY "Group members can add comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.media_items mi
      JOIN public.group_members gm ON gm.group_id = mi.group_id
      WHERE mi.id = media_item_id AND gm.user_id = auth.uid()
    )
  );

-- UPDATE: a user may edit only their own comment, and may not reassign authorship.
DROP POLICY IF EXISTS "Authors can edit their own comments" ON public.comments;
CREATE POLICY "Authors can edit their own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- DELETE: the comment's author OR the group owner (moderation) can delete it.
DROP POLICY IF EXISTS "Author or group owner can delete comments" ON public.comments;
CREATE POLICY "Author or group owner can delete comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.media_items mi
      JOIN public.group_members gm ON gm.group_id = mi.group_id
      WHERE mi.id = media_item_id AND gm.user_id = auth.uid() AND gm.role = 'owner'
    )
  );


-- 5. Privileges --------------------------------------------------------------
-- RLS does not replace table GRANTs. If you ran the ALTER DEFAULT PRIVILEGES
-- line in SUPABASE_SETUP.md Step 2h this is already covered; running it again
-- is harmless.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;


-- 6. Verify ------------------------------------------------------------------
-- Expected: the table, two indexes, one trigger and four policies all present.
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename = 'comments';
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'comments' ORDER BY cmd;
