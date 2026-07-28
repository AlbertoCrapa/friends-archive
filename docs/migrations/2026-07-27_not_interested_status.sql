-- ============================================================
-- Migration — "Not interested" item status          (2026-07-27)
-- ============================================================
-- Adds a FOURTH value to the per-member item_status enum:
--
--   plan_to_consume | consuming | completed | not_interested
--
-- 'not_interested' is a personal opt-out: the member is saying "count me out
-- of this one". It stays per-member like every other status (item_statuses,
-- one row per (item, user)) — nobody else's view of the item changes.
--
-- UI contract that goes with it (no SQL needed, see MediaTable):
--   * The opted-out member sees THEIR row greyed out and semi-transparent.
--   * Everyone else keeps seeing the item normally.
--   * The "everyone completed" green wash IGNORES members who opted out, so a
--     single "not interested" member no longer blocks the whole-group marker.
--   * 'not_interested' is NOT a completion: like plan_to_consume/consuming it
--     removes the member's consumption_records row (invariant below).
--
-- ⚠️ RUN THE TWO STEPS AS TWO SEPARATE QUERIES IN THE SUPABASE SQL EDITOR.
--    PostgreSQL will not let a new enum value be USED in the same transaction
--    that added it, so step 2 must run after step 1 has committed.
--
-- Depends on: the item_status enum and the item_statuses table.

-- ── STEP 1 — run this alone, first ───────────────────────────────────────────
ALTER TYPE public.item_status ADD VALUE IF NOT EXISTS 'not_interested';

-- ── STEP 2 — run this after step 1 succeeded ─────────────────────────────────
COMMENT ON COLUMN public.item_statuses.status IS
  'The member''s own progress: plan_to_consume (Planned) | consuming (In progress) | completed (Completed) | not_interested (Not interested — personal opt-out, greyed out for that member only).';

-- Invariant repair: "not interested" is never a completion, so it must never
-- travel with a consumption record. A no-op on a clean database — kept so the
-- script stays safe to re-run.
DELETE FROM public.consumption_records cr
USING public.item_statuses s
WHERE s.media_item_id = cr.media_item_id
  AND s.user_id       = cr.user_id
  AND s.status        = 'not_interested';

-- Verify (optional):
--   SELECT unnest(enum_range(NULL::item_status));
--   -> plan_to_consume, consuming, completed, not_interested
