// ============================================
// The meter's registry of external providers.
//
// One entry per thing we spend somebody else's quota on. This is the file to
// edit when a key is added, a plan is upgraded, or a provider changes its
// limits — nothing else in the meter knows a provider by name.
// ============================================

export type ApiProvider = 'tmdb' | 'rawg' | 'openlibrary';

export interface ProviderMeter {
  id: ApiProvider;
  label: string;
  /** The env var holding the key, or null for a keyless provider. */
  keyEnv: string | null;
  /**
   * What the provider will let us spend before it starts saying no. `null`
   * means the provider publishes no countable cap (TMDB caps a *rate*, not a
   * total), in which case the card shows volume without a gauge.
   */
  quota: { calls: number; per: 'day' | 'month'; label: string } | null;
  /** Where to go to see THEIR number — the billing truth, not ours. */
  dashboardUrl: string;
  /** One line on what actually bites, shown under the gauge. */
  note: string;
}

export const PROVIDER_METERS: ProviderMeter[] = [
  {
    id: 'tmdb',
    label: 'TMDB',
    keyEnv: 'TMDB_API_KEY',
    // TMDB removed its daily cap years ago and enforces ~50 requests/second
    // instead. There is no monthly number to fill, so the card reports volume
    // and the burst chart is the thing worth watching.
    quota: null,
    dashboardUrl: 'https://www.themoviedb.org/settings/api',
    note: 'No monthly cap — throttles at roughly 50 requests/second per key. Watch the daily shape, not a total.',
  },
  {
    id: 'rawg',
    label: 'RAWG',
    keyEnv: 'RAWG_API_KEY',
    // The tight one. RAWG's free tier is a hard monthly count and it is the
    // only key here that can realistically run out.
    quota: { calls: 20_000, per: 'month', label: '20,000 / month (free tier)' },
    dashboardUrl: 'https://rawg.io/apidocs',
    note: 'The one that can actually run out. RAWG stops answering for the rest of the month when the count is spent.',
  },
  {
    id: 'openlibrary',
    label: 'Open Library',
    keyEnv: null,
    // Keyless, so nobody can bill us — but they do block by IP when hammered,
    // and their published courtesy guidance is around 100 requests/5 minutes.
    // The daily figure below is our own self-imposed budget, not their rule:
    // it exists so the gauge has something to be a fraction of.
    quota: { calls: 5_000, per: 'day', label: '5,000 / day (our own budget)' },
    dashboardUrl: 'https://openlibrary.org/developers/api',
    note: 'No key and no bill — but they rate-limit by IP. The budget here is ours, set to catch a runaway loop.',
  },
];

export const METER_BY_ID: Record<ApiProvider, ProviderMeter> = Object.fromEntries(
  PROVIDER_METERS.map((meter) => [meter.id, meter]),
) as Record<ApiProvider, ProviderMeter>;

/**
 * Which provider a URL spends. Returns null for anything we don't meter —
 * image CDNs, our own Supabase — so those calls cost nothing to log.
 */
export function providerForUrl(url: string): ApiProvider | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host === 'api.themoviedb.org') return 'tmdb';
  if (host === 'api.rawg.io') return 'rawg';
  if (host === 'openlibrary.org') return 'openlibrary';
  return null;
}

/**
 * The shape of a call, with the variable parts taken out: numeric ids, OLIDs
 * and slugs all collapse to `:id`, and the query string — which carries the
 * key — is dropped entirely. `/api/games/3498?key=secret` becomes
 * `/api/games/:id`, so a table of endpoints stays a dozen rows long and never
 * holds a credential.
 */
export function endpointLabel(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'unknown';
  }
  return (
    path
      .split('/')
      .map((segment, index) => {
        if (!segment) return segment;
        // The first segment is the API root, never a record: TMDB's is
        // literally the version number `3`, and collapsing it to `:id` would
        // throw away the only part of the path that says which API this is.
        if (index === 1) return segment;
        if (/^\d+$/.test(segment)) return ':id';
        // Open Library work/edition keys: OL45804W, OL7353617M.
        if (/^OL\d+[A-Z]$/.test(segment)) return ':id';
        // "3498.json", "OL45804W.json" — the extension is part of the shape.
        if (/^(\d+|OL\d+[A-Z])\.json$/.test(segment)) return ':id.json';
        return segment;
      })
      .join('/') || '/'
  );
}
