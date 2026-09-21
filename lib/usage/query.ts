// ============================================
// The read half of the API meter.
// Server-only. Reads the rolled-up views with the service role and shapes
// them into exactly what the admin page draws.
// ============================================

// Server-only: this file reads with the SERVICE ROLE key. It must never be
// imported from a 'use client' module — the key would be bundled to the browser.
import { PROVIDER_METERS, METER_BY_ID, type ApiProvider } from './providers';
import { getSupabaseFootprint, type SupabaseFootprint } from './supabase';

const DAYS = 30;

interface DailyRow {
  provider: string;
  day: string; // 'YYYY-MM-DD'
  calls: number;
  upstream_calls: number;
  errors: number;
  avg_ms: number;
}

interface EndpointRow {
  provider: string;
  endpoint: string;
  calls: number;
  upstream_calls: number;
  errors: number;
}

interface FailureRow {
  provider: string;
  endpoint: string;
  status: number | null;
  duration_ms: number;
  created_at: string;
}

/** One day on the chart, with every provider's upstream count on it. */
export interface UsageDay {
  day: string;
  label: string;
  tmdb: number;
  rawg: number;
  openlibrary: number;
  errors: number;
}

export interface ProviderUsage {
  id: ApiProvider;
  label: string;
  configured: boolean;
  keyEnv: string | null;
  dashboardUrl: string;
  note: string;
  quota: { calls: number; per: 'day' | 'month'; label: string } | null;
  /** Calls that actually reached the provider inside the quota window. */
  spent: number;
  /** spent / quota as a percentage, or null when the provider publishes no cap. */
  percent: number | null;
  upstreamToday: number;
  upstream30d: number;
  cached30d: number;
  errors30d: number;
  avgMs: number;
  /** Upstream calls per day over the whole window, for the sparkline. */
  trend: number[];
  endpoints: { endpoint: string; calls: number; upstream: number; errors: number }[];
}

export interface UsageReport {
  /** False when the table hasn't been migrated yet — the page says so plainly. */
  ready: boolean;
  days: UsageDay[];
  providers: ProviderUsage[];
  failures: FailureRow[];
  /** Supabase isn't metered by counting calls - see lib/usage/supabase.ts. */
  footprint: SupabaseFootprint;
  generatedAt: string;
}

/**
 * Read one of the meter's views over PostgREST with the service role.
 *
 * Raw fetch rather than a Supabase client on purpose: the client in
 * lib/supabase/server.ts is built around the *user's* cookie session, and
 * this data is explicitly not the user's. Returns null — not an empty array —
 * when the read fails, so the caller can tell "no traffic yet" apart from
 * "the migration hasn't been run".
 */
async function readView<T>(path: string): Promise<T[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

/** UTC 'YYYY-MM-DD' — the same key the view groups on. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Everything the admin page needs, in one pass.
 *
 * The window is 30 days of daily rows; quota spend is counted over each
 * provider's own window (RAWG bills by calendar month, our Open Library
 * budget resets daily), which is why the two numbers on a card can disagree
 * and both be right.
 */
export async function getUsageReport(): Promise<UsageReport> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));

  const [daily, endpoints, failures, footprint] = await Promise.all([
    readView<DailyRow>(
      `api_usage_daily?day=gte.${dayKey(since)}&order=day.asc`,
    ),
    readView<EndpointRow>('api_usage_endpoints_30d?order=calls.desc&limit=60'),
    readView<FailureRow>(
      'api_usage?ok=is.false&order=created_at.desc&limit=12' +
        '&select=provider,endpoint,status,duration_ms,created_at',
    ),
    getSupabaseFootprint(),
  ]);

  const ready = daily !== null;
  const rows = daily ?? [];

  // A continuous 30-day axis. Days with no traffic must be drawn as zero, not
  // skipped — a gap in a usage chart reads as "we don't know", and here we do.
  const days: UsageDay[] = [];
  for (let offset = 0; offset < DAYS; offset += 1) {
    const date = new Date(since);
    date.setUTCDate(since.getUTCDate() + offset);
    const key = dayKey(date);
    const forDay = rows.filter((row) => row.day === key);
    days.push({
      day: key,
      // Pinned locale: the server and the browser pick different defaults,
      // and a mismatched label discards the hydrated tree.
      label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      tmdb: forDay.find((r) => r.provider === 'tmdb')?.upstream_calls ?? 0,
      rawg: forDay.find((r) => r.provider === 'rawg')?.upstream_calls ?? 0,
      openlibrary: forDay.find((r) => r.provider === 'openlibrary')?.upstream_calls ?? 0,
      errors: forDay.reduce((sum, r) => sum + r.errors, 0),
    });
  }

  const today = dayKey(new Date());
  const monthStart = today.slice(0, 7); // 'YYYY-MM'

  const providers: ProviderUsage[] = PROVIDER_METERS.map((meter) => {
    const mine = rows.filter((row) => row.provider === meter.id);
    const sum = (pick: (row: DailyRow) => number, filter?: (row: DailyRow) => boolean) =>
      mine.filter(filter ?? (() => true)).reduce((total, row) => total + pick(row), 0);

    const upstream30d = sum((r) => r.upstream_calls);
    const calls30d = sum((r) => r.calls);
    const upstreamToday = sum((r) => r.upstream_calls, (r) => r.day === today);

    // Each provider's cap is counted over ITS window, not ours.
    const spent =
      meter.quota?.per === 'day'
        ? upstreamToday
        : sum((r) => r.upstream_calls, (r) => r.day.startsWith(monthStart));

    // Weight the average by the calls behind it: a quiet day with one slow
    // response must not drag the mean as hard as a busy one.
    const weighted = mine.reduce((total, row) => total + row.avg_ms * row.upstream_calls, 0);

    return {
      id: meter.id,
      label: meter.label,
      configured: meter.keyEnv === null || Boolean(process.env[meter.keyEnv]),
      keyEnv: meter.keyEnv,
      dashboardUrl: meter.dashboardUrl,
      note: meter.note,
      quota: meter.quota,
      spent,
      percent: meter.quota ? Math.min(100, (spent / meter.quota.calls) * 100) : null,
      upstreamToday,
      upstream30d,
      cached30d: Math.max(0, calls30d - upstream30d),
      errors30d: sum((r) => r.errors),
      avgMs: upstream30d > 0 ? Math.round(weighted / upstream30d) : 0,
      trend: days.map((day) => day[meter.id]),
      endpoints: (endpoints ?? [])
        .filter((row) => row.provider === meter.id)
        .slice(0, 6)
        .map((row) => ({
          endpoint: row.endpoint,
          calls: row.calls,
          upstream: row.upstream_calls,
          errors: row.errors,
        })),
    };
  });

  return {
    ready,
    days,
    providers,
    failures: failures ?? [],
    footprint,
    generatedAt: new Date().toISOString(),
  };
}

export { METER_BY_ID };
