-- ============================================================
-- Migration - API usage meter                     (2026-09-22)
-- ============================================================
-- Adds ONE append-only table:
--
--   api_usage   -- one row per outbound call to an external provider
--
-- WHY IT EXISTS. Every provider key we hold (TMDB, RAWG, and the keyless
-- Open Library courtesy budget) is metered by somebody else, on a dashboard
-- we don't own, in a unit we can't see from here. When a key gets throttled
-- the app degrades silently by design - fetchJson never throws, it returns
-- null and the UI falls back to manual entry - so the FIRST symptom of a
-- blown quota is "search stopped finding things" with nothing to point at.
-- This table is the missing evidence: what we called, when, whether it came
-- back, and how long it took.
--
-- WHO WRITES IT. lib/providers/http.ts - the single chokepoint every adapter
-- already funnels through - posts one row per call with the service role key,
-- after the response is handed back, so the meter never sits in front of a
-- user's request. See lib/usage/record.ts.
--
-- WHO READS IT. Nobody in the app. This is operator data, not group data:
-- it is read only by /admin, which is gated on ADMIN_EMAILS, using the
-- service role. RLS is enabled with NO policies, which means anon and
-- authenticated see exactly zero rows even if they find the table name.
--
-- ON `cached`. Next's fetch cache sits in front of these calls and is shared
-- across every user (see the note in lib/providers/http.ts), so most of what
-- passes through fetchJson never reaches the provider at all. There is no
-- official header that says "this was served from the data cache", so we
-- infer it from the wall clock: a response that returns in under
-- CACHE_HIT_MS did not cross the network. It is a strong heuristic, not a
-- receipt - the provider's own dashboard stays the source of truth for
-- billing, and this table is the source of truth for trend and blame.

CREATE TABLE IF NOT EXISTS public.api_usage (
  id          BIGSERIAL PRIMARY KEY,
  -- 'tmdb' | 'rawg' | 'openlibrary' - see lib/usage/providers.ts. Kept as free
  -- text, not an enum: a new provider should be one adapter, not a migration.
  provider    TEXT        NOT NULL,
  -- The shape of the call with ids stripped ('/3/search/movie', '/api/games/:id'),
  -- so a million distinct lookups group into a handful of readable rows.
  endpoint    TEXT        NOT NULL,
  ok          BOOLEAN     NOT NULL DEFAULT TRUE,
  -- NULL when the call never got a response at all (timeout, DNS, abort).
  status      SMALLINT,
  cached      BOOLEAN     NOT NULL DEFAULT FALSE,
  duration_ms INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.api_usage IS
  'Append-only meter of outbound external provider calls. Operator-only: RLS on, no policies, written and read with the service role.';
COMMENT ON COLUMN public.api_usage.cached IS
  'Inferred, not reported: TRUE when the response returned faster than a network round trip, i.e. it was served by Next''s shared fetch cache and cost the provider nothing.';

-- Every read is "this provider, this window", newest first.
CREATE INDEX IF NOT EXISTS api_usage_provider_time_idx
  ON public.api_usage (provider, created_at DESC);
-- The error feed and the prune both scan on time alone.
CREATE INDEX IF NOT EXISTS api_usage_time_idx
  ON public.api_usage (created_at DESC);

-- Locked by default: enabled with no policies at all, so the anon and
-- authenticated roles can read nothing and write nothing. Only the service
-- role - which bypasses RLS - touches this table.
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_usage FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.api_usage_id_seq FROM anon, authenticated;
GRANT ALL ON public.api_usage TO service_role;
GRANT ALL ON SEQUENCE public.api_usage_id_seq TO service_role;

-- -- The rolled-up read ----------------------------------------------------
-- The admin page wants a few hundred day-rows, not a few hundred thousand
-- call-rows. Aggregating here means the payload is bounded by the number of
-- days on screen no matter how busy the app gets.
--
-- security_invoker = on so the view can never become a hole around the RLS
-- above: it runs as whoever selects from it, and only the service role can
-- select from the table underneath.
DROP VIEW IF EXISTS public.api_usage_daily;
CREATE VIEW public.api_usage_daily
  WITH (security_invoker = on) AS
SELECT
  provider,
  (created_at AT TIME ZONE 'UTC')::date                      AS day,
  COUNT(*)::int                                              AS calls,
  COUNT(*) FILTER (WHERE NOT cached)::int                    AS upstream_calls,
  COUNT(*) FILTER (WHERE NOT ok)::int                        AS errors,
  COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE NOT cached)), 0)::int AS avg_ms
FROM public.api_usage
GROUP BY 1, 2;

COMMENT ON VIEW public.api_usage_daily IS
  'One row per provider per UTC day. What /admin charts. upstream_calls is the number that actually costs quota.';

REVOKE ALL ON public.api_usage_daily FROM anon, authenticated;
GRANT SELECT ON public.api_usage_daily TO service_role;

-- -- What we actually call -------------------------------------------------
-- The other question the meter has to answer: when a number jumps, WHICH call
-- did it. Endpoints are already collapsed to their shape by
-- lib/usage/providers.ts (endpointLabel), so this stays a short table.
DROP VIEW IF EXISTS public.api_usage_endpoints_30d;
CREATE VIEW public.api_usage_endpoints_30d
  WITH (security_invoker = on) AS
SELECT
  provider,
  endpoint,
  COUNT(*)::int                           AS calls,
  COUNT(*) FILTER (WHERE NOT cached)::int AS upstream_calls,
  COUNT(*) FILTER (WHERE NOT ok)::int     AS errors
FROM public.api_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2;

COMMENT ON VIEW public.api_usage_endpoints_30d IS
  'Last 30 days by call shape. Answers "what is spending the quota", which the daily totals cannot.';

REVOKE ALL ON public.api_usage_endpoints_30d FROM anon, authenticated;
GRANT SELECT ON public.api_usage_endpoints_30d TO service_role;

-- -- Keeping it small ------------------------------------------------------
-- A quota question is never older than a couple of months, and this table
-- grows with traffic forever if nobody trims it. Run this by hand, or point
-- a Supabase cron job at it (Database -> Cron):
--   SELECT cron.schedule('prune-api-usage', '0 4 * * *', $$SELECT public.prune_api_usage(90)$$);
CREATE OR REPLACE FUNCTION public.prune_api_usage(keep_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INT;
BEGIN
  DELETE FROM public.api_usage
   WHERE created_at < NOW() - (keep_days || ' days')::interval;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_api_usage(INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_api_usage(INT) TO service_role;

-- Verify (optional, run as service role / SQL editor):
--   SELECT * FROM public.api_usage_daily ORDER BY day DESC, provider LIMIT 20;
--   SELECT provider, count(*) FROM public.api_usage GROUP BY 1;
--   -- should return zero rows for a logged-in member:
--   SET ROLE authenticated; SELECT count(*) FROM public.api_usage; RESET ROLE;
