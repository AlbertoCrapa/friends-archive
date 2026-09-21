// ============================================
// The Supabase half of the meter.
//
// Server-only: reads with the SERVICE ROLE key. Never import from a client
// component.
//
// The outside providers are metered by counting our own calls. Supabase is
// different - it meters the project, not the key, and the numbers already
// live in the database. So this asks Postgres instead of counting anything.
// ============================================

/** Free plan allowances, September 2026. Bump these if the plan changes. */
export const FREE_PLAN = {
  dbBytes: 500 * 1024 * 1024, // 500 MB
  storageBytes: 1024 * 1024 * 1024, // 1 GB
  mau: 50_000,
  /** Here for the card's copy only - it cannot be measured from inside. */
  egressBytes: 5 * 1024 * 1024 * 1024, // 5 GB
} as const;

export interface FootprintMeter {
  id: 'db' | 'storage' | 'mau';
  label: string;
  /** null when the underlying schema isn't there to read. */
  used: number | null;
  limit: number;
  /** Pre-formatted for display, because bytes and people render differently. */
  usedLabel: string;
  limitLabel: string;
  percent: number | null;
  caption: string;
}

export interface SupabaseFootprint {
  /** False when the function hasn't been migrated yet. */
  ready: boolean;
  meters: FootprintMeter[];
  tables: { name: string; bytes: number; label: string }[];
}

interface FootprintRow {
  db_bytes: number;
  storage_bytes: number | null;
  mau: number | null;
  tables: { name: string; bytes: number }[];
  measured_at: string;
}

/** Bytes as a human reads them. Two significant places is plenty for a gauge. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Call supabase_footprint() over PostgREST with the service role.
 *
 * Returns ready:false - not an error - when the function isn't there, so the
 * page can say "run the migration" instead of showing three zeros that look
 * like real measurements.
 */
export async function getSupabaseFootprint(): Promise<SupabaseFootprint> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let row: FootprintRow | null = null;
  if (url && serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/supabase_footprint`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      });
      if (res.ok) row = (await res.json()) as FootprintRow;
    } catch {
      row = null;
    }
  }

  if (!row) return { ready: false, meters: [], tables: [] };

  const share = (used: number | null, limit: number) =>
    used === null ? null : Math.min(100, (used / limit) * 100);

  return {
    ready: true,
    meters: [
      {
        id: 'db',
        label: 'Database',
        used: row.db_bytes,
        limit: FREE_PLAN.dbBytes,
        usedLabel: formatBytes(row.db_bytes),
        limitLabel: formatBytes(FREE_PLAN.dbBytes),
        percent: share(row.db_bytes, FREE_PLAN.dbBytes),
        caption: 'The whole project, indexes included. The one that grows on its own.',
      },
      {
        id: 'storage',
        label: 'File storage',
        used: row.storage_bytes,
        limit: FREE_PLAN.storageBytes,
        usedLabel: row.storage_bytes === null ? 'n/a' : formatBytes(row.storage_bytes),
        limitLabel: formatBytes(FREE_PLAN.storageBytes),
        percent: share(row.storage_bytes, FREE_PLAN.storageBytes),
        // Posters and covers are hotlinked from the providers' own CDNs, so
        // this should sit at zero forever. A number here means something
        // started uploading, which is worth noticing.
        caption: 'Artwork is hotlinked, never uploaded - this should stay at zero.',
      },
      {
        id: 'mau',
        label: 'Active users',
        used: row.mau,
        limit: FREE_PLAN.mau,
        usedLabel: row.mau === null ? 'n/a' : row.mau.toLocaleString('en-GB'),
        limitLabel: FREE_PLAN.mau.toLocaleString('en-GB'),
        percent: share(row.mau, FREE_PLAN.mau),
        caption: 'Signed in within 30 days. Ours is a rolling window; theirs is the month.',
      },
    ],
    tables: (row.tables ?? []).map((table) => ({
      name: table.name,
      bytes: table.bytes,
      label: formatBytes(table.bytes),
    })),
  };
}
