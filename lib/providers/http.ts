// ============================================
// Shared fetch helper for external provider adapters.
// Enforces a short timeout and NEVER throws — a failed external call must
// degrade to an empty result set, not break the request.
// ============================================

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
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
