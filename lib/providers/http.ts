// ============================================
// Shared fetch helper for external provider adapters.
// Enforces a short timeout and NEVER throws — a failed external call must
// degrade to an empty result set, not break the request.
//
// It is also the app's ONLY door out to a metered provider, which is why the
// usage meter is wired in here and nowhere else: every adapter that gets
// written from now on is counted without its author having to remember.
// ============================================

import { providerForUrl, endpointLabel } from '@/lib/usage/providers';
import { recordApiCall } from '@/lib/usage/record';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Fetch JSON with a hard timeout. Returns null on any failure (timeout, non-2xx,
 * network error, bad JSON) so callers can fall back to manual entry silently.
 *
 * `timeoutMs` is per-call: fast providers (TMDB, RAWG) keep the short default,
 * while Open Library — whose search endpoint routinely takes 4–5s — needs more.
 *
 * `revalidateSeconds` is how long Next may serve the same URL from its own
 * server-side cache. See the note on the fetch call: for reference data this is
 * the cheapest layer we have, because it is shared across every user.
 */
export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  revalidateSeconds: number = 3600
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Metered providers only. Image CDNs and anything unrecognised return null
  // here and skip the bookkeeping entirely.
  const provider = providerForUrl(url);
  const startedAt = Date.now();
  let status: number | null = null;
  let ok = false;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...headers },
      // External reference data is stable; let Next cache identical queries.
      //
      // This cache is SHARED BETWEEN USERS — it lives on the server, keyed by
      // the request — which is what makes the item sheet cheap: the first
      // friend to open a title pays the provider call, everyone else that day
      // is served from here without a single upstream request. Callers that
      // read reference data nobody edits (a synopsis, a runtime) pass a longer
      // window; search keeps the short default because a typed query is
      // different every time anyway.
      next: { revalidate: revalidateSeconds },
    });
    status = res.status;
    if (!res.ok) return null;
    const body = (await res.json()) as T;
    ok = true;
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (provider) {
      // recordApiCall is synchronous and returns immediately: it hands the
      // insert to Next's after() and nothing here is awaited. So this adds a
      // few microseconds to the provider call, not a database round trip —
      // and it swallows every error by design, so a broken meter can never
      // turn a working search into a failed one.
      recordApiCall({
        provider,
        endpoint: endpointLabel(url),
        ok,
        status,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}
