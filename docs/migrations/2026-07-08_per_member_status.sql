-- ============================================================
-- Migration — Per-Member Item Status              (2026-07-08)
-- ============================================================
-- Moves the progress status OFF the shared media_items row and into a
-- dedicated per-member table: item_statuses, one row per (item, user).
-- Everything else about an item stays shared. A missing row means
-- 'plan_to_consume' (UI label: "Planned").
--
-- Existing data is migrated so every CURRENT group member keeps what they
-- effectively see today:
--   * member has a consumption record for the item  -> 'completed'
--   * otherwise                                     -> the item's old shared status
--   * rows that would be 'plan_to_consume' are skipped (that is the default
--     meaning of "no row")
-- Consumption records of ex-members are also mirrored to 'completed' so the
-- completed <-> consumed invariant holds for every consumption row.
--
-- Run this whole file as ONE query in the Supabase SQL Editor, together with
-- deploying the matching frontend — the old code writes media_items.status,
-- which step 7 drops.
--
-- Depends on: media_items, profiles, groups, group_members,
-- consumption_records, the item_status enum and handle_updated_at().

-- 1. Table --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_statuses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id  UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  status         item_status NOT NULL DEFAULT 'plan_to_consume',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_item_status UNIQUE (media_item_id, user_id)
);

COMMENT ON TABLE public.item_statuses IS
  'Per-member progress status for a media item. One row per (item, user); a missing row means plan_to_consume. Status is personal — the shared media_items row carries no status.';
COMMENT ON COLUMN public.item_statuses.status IS
  'The member''s own progress: plan_to_consume (Planned) | consuming (In progress) | completed (Completed).';

-- 2. Indexes ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_item_statuses_media_item_id ON public.item_statuses (media_item_id);
CREATE INDEX IF NOT EXISTS idx_item_statuses_user_id       ON public.item_statuses (user_id);

-- 3. updated_at trigger (reuses handle_updated_at from the base setup) ---------
DROP TRIGGER IF EXISTS trg_item_statuses_updated_at ON public.item_statuses;
CREATE TRIGGER trg_item_statuses_updated_at
  BEFORE UPDATE ON public.item_statuses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. RLS ------------------------------------------------------------------------
ALTER TABLE public.item_statuses ENABLE ROW LEVEL SECURITY;

-- Read mirrors consumption_records: members see all statuses for items in
-- their groups; any authenticated user sees statuses for items in a PUBLIC
-- group (read-only view).
CREATE POLICY "Members see item statuses in their groups"
  ON public.item_statuses FOR SELECT
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

-- Writes are strictly personal: only your own row, and only for items in
-- groups you belong to. Nobody can ever change another member's status.
CREATE POLICY "Users can set their own item status"
  ON public.item_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.media_items mi
      JOIN public.group_members gm ON gm.group_id = mi.group_id
      WHERE mi.id = media_item_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own item status"
  ON public.item_statuses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own item status"
  ON public.item_statuses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Privileges (covered by ALTER DEFAULT PRIVILEGES from setup §2h; safe to repeat)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_statuses TO authenticated;

-- 6. Data migration --------------------------------------------------------------
-- 6a. Every CURRENT member of each group gets the status they effectively see
--     today: 'completed' when they personally consumed the item, otherwise the
--     item's old shared status. Default-valued rows are skipped.
INSERT INTO public.item_statuses (media_item_id, user_id, status)
SELECT
  mi.id,
  gm.user_id,
  CASE WHEN cr.id IS NOT NULL THEN 'completed'::item_status ELSE mi.status END
FROM public.media_items mi
JOIN public.group_members gm ON gm.group_id = mi.group_id
LEFT JOIN public.consumption_records cr
  ON cr.media_item_id = mi.id AND cr.user_id = gm.user_id
WHERE cr.id IS NOT NULL OR mi.status <> 'plan_to_consume'
ON CONFLICT (media_item_id, user_id) DO NOTHING;

-- 6b. Mirror any remaining consumption records (e.g. from ex-members) so
--     status 'completed' and a consumption row always travel together.
INSERT INTO public.item_statuses (media_item_id, user_id, status)
SELECT cr.media_item_id, cr.user_id, 'completed'::item_status
FROM public.consumption_records cr
ON CONFLICT (media_item_id, user_id) DO NOTHING;

-- 7. Drop the shared status from media_items --------------------------------------
DROP INDEX IF EXISTS idx_media_items_status;
ALTER TABLE public.media_items DROP COLUMN IF EXISTS status;
