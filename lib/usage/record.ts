// ============================================
// The write half of the API meter.
// Server-only. One row per outbound provider call, posted with the service
// role key AFTER the response has been handed back to the caller.
// ============================================

import { after } from 'next/server';
import type { ApiProvider } from './providers';

/**
 * Below this, the response did not cross the network — it came out of Next's
 * shared fetch cache and cost the provider nothing. A real round trip to
 * TMDB, RAWG or Open Library is tens to hundreds of milliseconds; a cache
 * read is a file read. See the note on `cached` in the migration: this is an
 * inference, and deliberately generous, because over-counting an upstream
 * call is the safe direction to be wrong in.
 */
const CACHE_HIT_MS = 15;

export interface ApiCallRecord {
  provider: ApiProvider;
  endpoint: string;
  ok: boolean;
  /** null when nothing ever came back (timeout, abort, DNS). */
  status: number | null;
  durationMs: number;
}

/**
 * Write one call to the meter.
 *
 * Deliberately fire-and-forget, and deliberately silent. The meter is
 * bookkeeping: a member searching for a film must never wait on it, and must
 * never see it fail. Every failure path here — no service key configured,
 * table not migrated yet, Supabase down — ends in the same place, which is
 * nothing happening.
 *
 * `after()` hands the work to Next to run once the response is flushed, which
 * is what keeps it off the user's clock on a serverless host (a bare promise
 * can be killed when the function returns). Outside a request context —
 * a script, a test — it falls back to just letting the promise run.
 */
export function recordApiCall(call: ApiCallRecord): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const row = {
    provider: call.provider,
    endpoint: call.endpoint,
    ok: call.ok,
    status: call.status,
    cached: call.ok && call.durationMs < CACHE_HIT_MS,
    duration_ms: Math.round(call.durationMs),
  };

  const write = () =>
    fetch(`${url}/rest/v1/api_usage`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      // Never cached, never metered — this is our own database, not a provider.
      cache: 'no-store',
    }).catch(() => {});

  try {
    after(write);
  } catch {
    // No request context to attach to; run it loose rather than lose it.
    void write();
  }
}
