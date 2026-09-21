-- ============================================================
-- Migration - Supabase free-tier footprint          (2026-09-22)
-- ============================================================
-- Adds ONE read-only function:
--
--   supabase_footprint()  -- how much of the free plan this project is using
--
-- WHY A FUNCTION AND NOT AN API CALL. Supabase's Management API does not
-- report the free-plan meters (it reports API request counts), and it
-- authenticates with a personal access token that carries the privileges of
-- the whole account - a far bigger secret than anything else this app holds,
-- for a read-only dashboard. Three of the four limits that can actually bite
-- are already sitting inside the database, so we ask Postgres directly and
-- introduce no new credential.
--
-- WHAT IT CAN SEE (free plan allowances, September 2026):
--   database size    500 MB   - exact, pg_database_size
--   storage          1 GB     - exact, sum of storage.objects metadata
--   monthly users    50,000   - close, see the note on MAU below
--
-- WHAT IT CANNOT SEE:
--   egress           5 GB     - measured by Supabase at their edge, invisible
--                               from in here. /admin links out for this one.
--
-- ON MAU. Supabase counts a user as active when they make an auth request in
-- the billing month. We count distinct users whose last_sign_in_at falls in
-- the last 30 days, which is the same population read a slightly different
-- way: a rolling window instead of a calendar month, and a session refreshed
-- without a fresh sign-in does not move the date. For an archive shared by a
-- handful of friends against a ceiling of 50,000 the difference cannot
-- matter; if this project ever gets near that number, read theirs, not ours.
--
-- SECURITY DEFINER because it reads auth.users and storage.objects, which the
-- caller has no business reading directly. It returns aggregate numbers only
-- - never a row, never an email - and EXECUTE is granted to service_role
-- alone, so only /admin can call it.

CREATE OR REPLACE FUNCTION public.supabase_footprint()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  db_bytes      bigint;
  storage_bytes bigint;
  mau           int;
  biggest       jsonb;
BEGIN
  db_bytes := pg_database_size(current_database());

  -- Each of these lives in a schema this project may not have provisioned.
  -- A missing extension must return "unknown", not break the whole page.
  BEGIN
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
      INTO storage_bytes FROM storage.objects;
  EXCEPTION WHEN OTHERS THEN
    storage_bytes := NULL;
  END;

  BEGIN
    SELECT COUNT(*) INTO mau
      FROM auth.users
     WHERE last_sign_in_at > NOW() - INTERVAL '30 days';
  EXCEPTION WHEN OTHERS THEN
    mau := NULL;
  END;

  -- When the 500 MB starts filling, the next question is always "with what".
  -- Total relation size, so indexes and TOAST count where they actually land.
  SELECT COALESCE(jsonb_agg(t ORDER BY t.bytes DESC), '[]'::jsonb)
    INTO biggest
    FROM (
      SELECT c.relname::text AS name, pg_total_relation_size(c.oid) AS bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
       ORDER BY 2 DESC
       LIMIT 8
    ) t;

  RETURN jsonb_build_object(
    'db_bytes',      db_bytes,
    'storage_bytes', storage_bytes,
    'mau',           mau,
    'tables',        biggest,
    'measured_at',   NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.supabase_footprint() IS
  'Aggregate free-plan usage read from inside the database: size, storage, rolling 30-day active users, biggest tables. Egress is not visible from here. Operator-only.';

REVOKE ALL ON FUNCTION public.supabase_footprint() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supabase_footprint() TO service_role;

-- Verify (optional):
--   SELECT jsonb_pretty(public.supabase_footprint());
