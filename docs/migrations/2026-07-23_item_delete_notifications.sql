-- ============================================================================
-- THE FRIEND ARCHIVE — Item-delete notifications                 (2026-07-23)
--
-- Run this ENTIRE block in the Supabase SQL Editor. Additive and idempotent.
--
-- WHY A STORED TABLE (a departure from the app's "notifications are derived"
-- rule, DATA_MODEL §6.6): join-request notifications can be derived because the
-- request row still exists. A DELETED media item leaves NOTHING to query, so
-- "X deleted <title>" must be recorded the moment it happens. This table is the
-- one stored-notification channel; the `type` column keeps it open to future
-- notification kinds.
--
-- FLOW: any member may now delete a shared item (see the RLS hardening
-- migration). A BEFORE DELETE trigger on media_items writes one notification row
-- for every OTHER current member of the group. The deleter is not notified.
--
-- Depends on: profiles, groups, group_members, media_items, handle_updated_at().
-- ============================================================================


-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,  -- recipient
  group_id    UUID REFERENCES public.groups(id)   ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,          -- who acted
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_type_valid CHECK (type IN ('item_deleted'))
);

COMMENT ON TABLE public.notifications IS
  'Per-recipient stored notifications. Written only by SECURITY DEFINER triggers/functions; recipients read and dismiss their own. payload carries display fields so the source row can be gone (e.g. a deleted item).';


-- 2. Indexes -----------------------------------------------------------------
-- Unread badge + the recipient's list, newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_id, created_at DESC);


-- 3. Row Level Security ------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- A user sees only their own notifications.
DROP POLICY IF EXISTS "Users read their own notifications" ON public.notifications;
CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- A user can mark their own notifications read (and nothing else — the row must
-- stay theirs). No creating notifications for anyone via the API.
DROP POLICY IF EXISTS "Users update their own notifications" ON public.notifications;
CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- A user can dismiss (delete) their own notifications.
DROP POLICY IF EXISTS "Users delete their own notifications" ON public.notifications;
CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- There is intentionally NO INSERT policy: rows are created only by the
-- SECURITY DEFINER trigger below, so nobody can forge a notification.

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;


-- 4. Trigger: notify the OTHER members when a member deletes an item ----------
CREATE OR REPLACE FUNCTION public.notify_item_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      UUID := auth.uid();
  v_group_name TEXT;
BEGIN
  SELECT name INTO v_group_name FROM public.groups WHERE id = OLD.group_id;

  INSERT INTO public.notifications (user_id, group_id, actor_id, type, payload)
  SELECT
    gm.user_id,
    OLD.group_id,
    v_actor,
    'item_deleted',
    jsonb_build_object(
      'item_title', OLD.title,
      'item_type',  OLD.type,
      'group_name', v_group_name
    )
  FROM public.group_members gm
  WHERE gm.group_id = OLD.group_id
    AND gm.user_id IS DISTINCT FROM v_actor;   -- never notify the deleter

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_item_deleted ON public.media_items;
CREATE TRIGGER trg_notify_item_deleted
  BEFORE DELETE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_item_deleted();

-- Not a public RPC — it only ever runs as a trigger.
REVOKE EXECUTE ON FUNCTION public.notify_item_deleted() FROM anon, authenticated;


-- 5. Verify ------------------------------------------------------------------
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='notifications' ORDER BY cmd;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.media_items'::regclass;
--
-- Frontend follow-up (not SQL): a bell/list that reads notifications for
-- auth.uid(), shows the unread count (read_at IS NULL), and sets read_at when
-- opened. When a whole group is deleted, its media_items cascade-delete and any
-- rows this trigger writes cascade away with the group (group_id FK) — so group
-- deletion produces no leftover "item deleted" spam.
