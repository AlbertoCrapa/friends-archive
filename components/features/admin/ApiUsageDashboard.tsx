'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ExternalLink, KeyRound, TriangleAlert } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeDate } from '@/lib/utils';
import type { ProviderUsage, UsageReport } from '@/lib/usage/query';

/**
 * Colour means the same thing here as everywhere else in the app: the kind of
 * thing being counted. TMDB is what fills the movie shelf, RAWG the games,
 * Open Library the books — so each provider wears the hue its own media type
 * already wears on the archive charts.
 */
const PROVIDER_CONFIG: ChartConfig = {
  tmdb: { label: 'TMDB', color: 'var(--chart-movie)' },
  rawg: { label: 'RAWG', color: 'var(--chart-video_game)' },
  openlibrary: { label: 'Open Library', color: 'var(--chart-book)' },
};

/** Where a gauge stops being informative and starts being a warning. */
const WARN_AT = 70;
const DANGER_AT = 90;

function toneFor(percent: number | null): 'calm' | 'warn' | 'danger' {
  if (percent === null) return 'calm';
  if (percent >= DANGER_AT) return 'danger';
  if (percent >= WARN_AT) return 'warn';
  return 'calm';
}

export function ApiUsageDashboard({ report }: { report: UsageReport }) {
  const [focus, setFocus] = useState<string | null>(null);

  // Something worth putting at the top of the page: the single provider
  // closest to its own ceiling. That is the only number that ever needs
  // acting on, and it should not have to be found by reading three cards.
  const tightest = useMemo(() => {
    const gauged = report.providers.filter((p) => p.percent !== null);
    if (gauged.length === 0) return null;
    return gauged.reduce((worst, p) => (p.percent! > worst.percent! ? p : worst));
  }, [report.providers]);

  const anyTraffic = report.providers.some((p) => p.upstream30d > 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-stone-50">
            API usage
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-snug text-stone-500">
            Every call this app makes to an outside provider, counted where it
            leaves us. The provider&apos;s own dashboard is still the billing
            truth — this is the part they can&apos;t tell you: which of our
            calls, on which day, and what the cache saved.
          </p>
        </div>
        <p className="text-[12px] text-stone-600">
          Read {formatRelativeDate(report.generatedAt).toLowerCase()} · last 30 days
        </p>
      </header>

      {!report.ready && (
        <Notice tone="warn">
          The meter isn&apos;t recording yet. Run{' '}
          <code className="rounded bg-stone-800 px-1 py-0.5 text-[12px] text-stone-300">
            docs/migrations/2026-09-22_api_usage.sql
          </code>{' '}
          in the Supabase SQL editor — until that table exists every number
          below is a zero, and no provider call is being counted.
        </Notice>
      )}

      {report.ready && tightest && tightest.percent !== null && tightest.percent >= WARN_AT && (
        <Notice tone={tightest.percent >= DANGER_AT ? 'danger' : 'warn'}>
          <strong className="font-semibold text-stone-100">{tightest.label}</strong> is at{' '}
          {Math.round(tightest.percent)}% of {tightest.quota?.label}. At the
          ceiling it stops answering and the app falls back to manual entry
          without telling anyone.
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {report.providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      <Panel
        title="Calls that reached a provider"
        caption="Per day, per provider. Cache hits are left out — this is the line that spends quota."
      >
        {anyTraffic ? (
          <ChartContainer
            config={PROVIDER_CONFIG}
            style={{ height: 260 }}
            className="mt-1"
          >
            <AreaChart data={report.days} margin={{ left: -18, right: 6, top: 6 }}>
              <defs>
                {Object.keys(PROVIDER_CONFIG).map((key) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={0.04} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                // Thirty labels don't fit; every fifth day is enough to read
                // the shape and still know where you are.
                interval={4}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} width={46} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {(['tmdb', 'rawg', 'openlibrary'] as const).map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="calls"
                  stroke={`var(--color-${key})`}
                  fill={`url(#fill-${key})`}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-[13px] text-stone-500">
            No provider call has been recorded yet. Search for a film or a game
            and this fills in.
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="What spends it"
          caption="The last 30 days by call shape. When a total jumps, this says which call did it."
        >
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wide text-stone-600">
                  <th className="px-1 pb-2 font-medium">Endpoint</th>
                  <th className="px-1 pb-2 text-right font-medium">Upstream</th>
                  <th className="px-1 pb-2 text-right font-medium">Cached</th>
                  <th className="px-1 pb-2 text-right font-medium">Failed</th>
                </tr>
              </thead>
              <tbody>
                {report.providers.flatMap((provider) =>
                  provider.endpoints.map((row) => (
                    <tr
                      key={`${provider.id}:${row.endpoint}`}
                      onMouseEnter={() => setFocus(provider.id)}
                      onMouseLeave={() => setFocus(null)}
                      className={cn(
                        'border-t border-white/[0.05] transition-colors',
                        focus === provider.id && 'bg-white/[0.03]',
                      )}
                    >
                      <td className="px-1 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: PROVIDER_CONFIG[provider.id]?.color }}
                          />
                          <span className="truncate font-mono text-[12px] text-stone-300">
                            {row.endpoint}
                          </span>
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-stone-200">
                        {row.upstream.toLocaleString('en-GB')}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-stone-500">
                        {(row.calls - row.upstream).toLocaleString('en-GB')}
                      </td>
                      <td
                        className={cn(
                          'px-1 py-2 text-right tabular-nums',
                          row.errors > 0 ? 'text-red-300' : 'text-stone-600',
                        )}
                      >
                        {row.errors}
                      </td>
                    </tr>
                  )),
                )}
                {report.providers.every((p) => p.endpoints.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-stone-500">
                      Nothing recorded in the last 30 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="What came back wrong"
          caption="The most recent failures — a timeout, a refusal, a throttle. An empty list here is the good outcome."
        >
          {report.failures.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-stone-500">
              No failed provider call on record.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {report.failures.map((failure, index) => (
                <li
                  key={`${failure.created_at}-${index}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: PROVIDER_CONFIG[failure.provider]?.color }}
                    />
                    <span className="truncate font-mono text-[12px] text-stone-300">
                      {failure.endpoint}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[12px]">
                    <span className="text-red-300">
                      {/* No status at all means nothing ever came back — the
                          3s timeout fired, or the host never answered. */}
                      {failure.status ?? `timeout ${failure.duration_ms}ms`}
                    </span>
                    <span className="text-stone-600">
                      {formatRelativeDate(failure.created_at).toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderUsage }) {
  const tone = toneFor(provider.percent);
  const colour = PROVIDER_CONFIG[provider.id]?.color ?? 'var(--color-accent)';
  // A cache hit is a call we didn't have to buy. Stating it as a share of the
  // total is the honest way to show it: it is the reason the spend is low.
  const total = provider.upstream30d + provider.cached30d;
  const savedShare = total > 0 ? Math.round((provider.cached30d / total) * 100) : 0;

  return (
    <section className="flex flex-col rounded-[var(--radius-lg)] border border-white/[0.07] bg-stone-900 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-stone-100">
            {provider.label}
          </h3>
          <p className="mt-0.5 text-[12px] text-stone-500">
            {provider.quota ? provider.quota.label : 'No published cap'}
          </p>
        </div>
        {provider.keyEnv === null ? (
          <Badge variant="secondary">keyless</Badge>
        ) : provider.configured ? (
          <Badge variant="public">
            <KeyRound aria-hidden /> key set
          </Badge>
        ) : (
          <Badge variant="destructive">
            <TriangleAlert aria-hidden /> no key
          </Badge>
        )}
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            'text-[30px] font-semibold leading-none tracking-[-0.03em]',
            tone === 'danger' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-stone-50',
          )}
          style={{ fontVariationSettings: '"opsz" 64' }}
        >
          {provider.spent.toLocaleString('en-GB')}
        </span>
        <span className="text-[13px] text-stone-400">
          {provider.quota
            ? `of ${provider.quota.calls.toLocaleString('en-GB')} this ${provider.quota.per}`
            : `calls this month`}
        </span>
      </p>

      {provider.percent !== null ? (
        <div
          className="mt-3 h-[6px] overflow-hidden rounded-full bg-[var(--chart-grid)]"
          role="img"
          aria-label={`${Math.round(provider.percent)}% of ${provider.label} quota used`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(provider.percent, provider.spent > 0 ? 1.5 : 0)}%`,
              background:
                tone === 'danger'
                  ? 'var(--color-destructive)'
                  : tone === 'warn'
                    ? 'var(--color-warning)'
                    : colour,
            }}
          />
        </div>
      ) : (
        // No cap to be a fraction of, so the 30-day shape does the work
        // instead — a flat line is fine, a cliff is the thing to notice.
        <Sparkline values={provider.trend} colour={colour} />
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-3">
        <Stat label="Today" value={provider.upstreamToday.toLocaleString('en-GB')} />
        <Stat
          label="Cache saved"
          value={`${savedShare}%`}
          hint={`${provider.cached30d.toLocaleString('en-GB')} calls`}
        />
        <Stat
          label="Failed"
          value={String(provider.errors30d)}
          tone={provider.errors30d > 0 ? 'bad' : undefined}
        />
      </dl>

      <p className="mt-3 text-[12px] leading-snug text-stone-500">{provider.note}</p>

      <a
        href={provider.dashboardUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-stone-400 transition-colors hover:text-amber-300"
      >
        Their dashboard <ExternalLink className="size-3" aria-hidden />
      </a>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'bad';
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-stone-600">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[15px] font-medium tabular-nums',
          tone === 'bad' ? 'text-red-300' : 'text-stone-200',
        )}
      >
        {value}
        {hint && <span className="ml-1 text-[11.5px] text-stone-600">{hint}</span>}
      </dd>
    </div>
  );
}

/**
 * Thirty days in 40 pixels. Hand-drawn rather than a chart component: at this
 * size there are no axes, no tooltip and no legend to earn the weight.
 */
function Sparkline({ values, colour }: { values: number[]; colour: string }) {
  const peak = Math.max(1, ...values);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 100 - (value / peak) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="mt-3 h-[34px] w-full"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={colour}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: 'warn' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-[var(--radius-lg)] border px-4 py-3 text-[13px] leading-snug',
        tone === 'danger'
          ? 'border-red-500/25 bg-red-500/10 text-red-200'
          : 'border-amber-500/25 bg-amber-500/10 text-amber-200',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-white/[0.07] bg-stone-900 p-4">
      <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-stone-100">{title}</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] leading-snug text-stone-500">{caption}</p>
      {children}
    </section>
  );
}
