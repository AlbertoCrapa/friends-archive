-- ============================================================
-- Migration — Ratings on a completion            (2026-09-20)
-- ============================================================
-- Adds ONE nullable column to consumption_records:
--
--   rating SMALLINT NULL   -- 1..5, the member's own verdict
--
-- WHY IT LIVES HERE. consumption_records already holds exactly one row per
-- (item, member) and already means "I finished this", with a `note` column for
-- what you thought. A rating is the same statement in numbers, by the same
-- person, about the same completion — so it belongs on that row, not in a new
-- table and not on the shared media_items row, which carries nothing personal
-- by design (DATA_MODEL § 6.9). The unique constraint on (media_item_id,
-- user_id) already guarantees one rating per member per item, for free.
--
-- WHAT IT UNLOCKS. The item sheet shows each friend's stars next to their note,
-- and the group's own average beside the outside world's score. Until this is
-- run the sheet simply does not offer stars: the client asks for the column,
-- notices it is not there, remembers that for the session and re-reads without
-- it. Nothing else changes and nothing breaks.
--
-- Additive and safe to run once: existing rows keep NULL, which reads as
-- "finished it, didn't rate it".
--
-- Depends on: § 2f (consumption_records).

ALTER TABLE public.consumption_records
  ADD COLUMN IF NOT EXISTS rating SMALLINT;

-- Five stars, or nothing. The UI (components/micro/PeekRating) offers exactly
-- these five and lets a member clear their rating by pressing the current one
-- again, which writes NULL.
ALTER TABLE public.consumption_records
  DROP CONSTRAINT IF EXISTS rating_range;
ALTER TABLE public.consumption_records
  ADD CONSTRAINT rating_range
    CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

COMMENT ON COLUMN public.consumption_records.rating IS
  'The member''s own 1-5 verdict on the item they finished. NULL means finished without rating. Personal: written only by its owner, readable by the group exactly like the note beside it.';

-- RLS / privileges: nothing changes. The new column rides the existing
-- consumption_records policies — a member may write only their own row
-- ("Users can update their own consumption records"), and the whole group may
-- read it, which is the point of a shared archive.

-- Verify (optional):
--   SELECT rating, count(*) FROM public.consumption_records GROUP BY 1 ORDER BY 1;
--   -- should be rejected:
--   UPDATE public.consumption_records SET rating = 9 WHERE false;
