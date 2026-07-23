-- ============================================================================
-- THE FRIEND ARCHIVE — RLS Hardening                              (2026-07-23)
--
-- Run this ENTIRE block in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- It is a SECURITY FIX. It is idempotent and safe to run once on any existing
-- database that already has the schema from docs/SUPABASE_SETUP.md. It changes
-- NO data and adds no tables — it only replaces five Row Level Security
-- policies whose write checks were silently too permissive.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- Five write policies correlated a group membership check with the bare column
-- name `group_id`, inside a subquery that ALSO selects from a table containing a
-- `group_id` column:
--
--     EXISTS (SELECT 1 FROM public.group_members gm
--             WHERE gm.group_id = group_id            --  <-- the bug
--               AND gm.user_id = auth.uid() ...)
--
-- PostgreSQL resolves the unqualified `group_id` against the INNERMOST scope
-- first. Because `gm` (group_members) has a `group_id` column, the bare
-- `group_id` binds to `gm.group_id`, NOT to the outer row being written. The
-- predicate becomes `gm.group_id = gm.group_id` — always true — so the whole
-- EXISTS degrades from "is the caller a member/owner of THIS group" to
-- "is the caller a member/owner of ANY group at all".
--
-- Real-world impact (all require a direct PostgREST/API call — the app UI never
-- sends these, which is why it went unnoticed):
--   * media_items INSERT : a member of ANY group could insert an item into a
--                          group they do NOT belong to.
--   * media_items UPDATE : a member of ANY group could edit items in a group
--                          they do NOT belong to (and added_by immutability was
--                          also broken by the same shadowing pattern).
--   * media_items DELETE : an owner of ANY group could delete items in a group
--                          they do NOT own — including a public group they only
--                          view read-only.
--   * group_members UPDATE / DELETE : an owner of ANY group could change roles
--                          or kick members in a group they do NOT own.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- Every check is rewritten to use the SECURITY DEFINER helper functions
-- is_group_member(group_id, uid) / is_group_owner(group_id, uid). At the top
-- level of a policy expression the bare `group_id` correctly binds to the target
-- row, and passing it as a FUNCTION ARGUMENT removes the shadowing entirely.
-- These helpers already exist (SUPABASE_SETUP.md §4f and §5-pre) and are already
-- used safely by the group_members SELECT and group_join_requests policies.
--
-- Two intentional tightenings, matching the frontend exactly:
--   * added_by on media_items stays immutable on UPDATE (fixed with an alias so
--     it compares NEW vs OLD instead of NEW vs itself). Service role still
--     bypasses RLS for admin fixes.
--   * The group OWNER can no longer delete their OWN group_members row (that
--     would orphan the group). The UI offers owners "Delete group", not
--     "Leave" — this makes RLS agree. Non-owner members can still leave.
--
-- Depends on: is_group_member(uuid,uuid), is_group_owner(uuid,uuid)  — both
-- SECURITY DEFINER, both already callable by `authenticated`.
-- ============================================================================


-- 1. group_members — role updates: only the owner of THIS group -----------------
DROP POLICY IF EXISTS "Group owner can update member roles" ON public.group_members;
CREATE POLICY "Group owner can update member roles"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING      (public.is_group_owner(group_id, auth.uid()))
  WITH CHECK (public.is_group_owner(group_id, auth.uid()));


-- 2. group_members — removals ---------------------------------------------------
--    * a non-owner member removes their OWN row (leave the group)
--    * the owner removes SOMEONE ELSE (never themselves — they delete the group)
DROP POLICY IF EXISTS "Owner can remove members; users can leave" ON public.group_members;
CREATE POLICY "Owner can remove members; users can leave"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND NOT public.is_group_owner(group_id, auth.uid()))
    OR (public.is_group_owner(group_id, auth.uid()) AND user_id <> auth.uid())
  );


-- 3. media_items — INSERT: only a member of THIS group, only as themselves ------
DROP POLICY IF EXISTS "Group members can add items" ON public.media_items;
CREATE POLICY "Group members can add items"
  ON public.media_items FOR INSERT
  TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND public.is_group_member(group_id, auth.uid())
  );


-- 4. media_items — UPDATE: any member of THIS group; added_by is immutable ------
--    The immutability check uses an aliased subquery (m) so `media_items.id`
--    resolves to the row being written and the subquery returns the OLD
--    added_by from the statement snapshot: NEW.added_by must equal OLD.added_by.
DROP POLICY IF EXISTS "Group members can update items" ON public.media_items;
CREATE POLICY "Group members can update items"
  ON public.media_items FOR UPDATE
  TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND added_by = (SELECT m.added_by FROM public.media_items m WHERE m.id = media_items.id)
  );


-- 5. media_items — DELETE: ANY member of THIS group ----------------------------
--    (Product rule 2026-07-23: any member can delete a shared item; the other
--    members are told via a notification — see the item-delete notifications
--    migration. Non-members and public-group viewers stay blocked.)
DROP POLICY IF EXISTS "Item creator or group owner can delete items" ON public.media_items;
DROP POLICY IF EXISTS "Group members can delete items" ON public.media_items;
CREATE POLICY "Group members can delete items"
  ON public.media_items FOR DELETE
  TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));


-- 6. Verify ---------------------------------------------------------------------
-- Expected: five policies, listed with their command, all present.
-- SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('group_members', 'media_items')
--   ORDER BY tablename, cmd, policyname;
