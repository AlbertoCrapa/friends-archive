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
 */
export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...headers },
      // External reference data is stable; let Next cache identical queries briefly.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
