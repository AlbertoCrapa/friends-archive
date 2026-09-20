'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { TYPE_ICONS } from './MediaPoster';
import { isFinishedByEveryone } from '@/lib/utils';
import { getTypePluralLabel } from '@/types';
import type { MediaItemWithDetails, MediaType } from '@/types';

const TYPES: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];
const MONTHS = 12;

/** Kind is the one categorical dimension here, so its four hues are fixed and
 *  reused on every surface. The values live in globals.css. */
const TYPE_CONFIG: ChartConfig = {
  movie: { label: 'Movies', color: 'var(--chart-movie)', icon: TYPE_ICONS.movie },
  tv_series: { label: 'TV', color: 'var(--chart-tv_series)', icon: TYPE_ICONS.tv_series },
  book: { label: 'Books', color: 'var(--chart-book)', icon: TYPE_ICONS.book },
  video_game: { label: 'Games', color: 'var(--chart-video_game)', icon: TYPE_ICONS.video_game },
};

const PROGRESS_CONFIG: ChartConfig = {
  completed: { label: 'Finished', color: 'var(--chart-progress)' },
};

const VOLUME_CONFIG: ChartConfig = {
  added: { label: 'Added', color: 'var(--chart-volume)' },
};

interface Props {
  items: MediaItemWithDetails[];
  members: { id: string; nickname: string }[];
  memberIds: string[];
  notInterestedByItem: Record<string, string[]>;
  userId: string;
  consumedSet: Set<string>;
}

/**
 * The archive, counted.
 *
 * Three questions a list cannot answer at a glance: how far each member has
 * got, what the shelf is actually made of, and whether anyone is still adding
 * to it. Each chart carries ONE measure. Where colour means something it means
 * the kind of thing an item is, and it means that everywhere in the app; where
 * a chart is a single measure it takes the single hue for what it counts, and
 * length does the work instead.
 */
export function ArchiveStats({
  items,
  members,
  memberIds,
  notInterestedByItem,
  userId,
  consumedSet,
}: Props) {
  const stats = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const finishedByEveryone = items.filter((item) =>
      isFinishedByEveryone({
        itemId: item.id,
        consumerIds: (item.consumption_records ?? []).map((record) => record.user_id),
        memberIds,
        notInterestedByItem,
        viewerId: userId,
        viewerConsumed: consumedSet.has(item.id),
      }),
    ).length;

    const addedRecently = items.filter(
      (item) => now - new Date(item.created_at).getTime() < 30 * DAY,
    ).length;

    const onYou = items.filter(
      (item) =>
        !consumedSet.has(item.id) && !(notInterestedByItem[item.id] ?? []).includes(userId),
    ).length;

    const roster = (members.length > 0 ? members : memberIds.map((id) => ({ id, nickname: 'Member' })))
      .map((member) => {
        let completed = 0;
        let skipped = 0;
        let added = 0;
        for (const item of items) {
          if (item.added_by === member.id) added += 1;
          if ((notInterestedByItem[item.id] ?? []).includes(member.id)) {
            skipped += 1;
            continue;
          }
          const done =
            member.id === userId
              ? consumedSet.has(item.id)
              : (item.consumption_records ?? []).some((record) => record.user_id === member.id);
          if (done) completed += 1;
        }
        const considered = items.length - skipped;
        return {
          id: member.id,
          name: member.id === userId ? 'You' : member.nickname,
          completed,
          skipped,
          added,
          considered,
          remaining: Math.max(0, considered - completed),
          share: considered > 0 ? Math.round((completed / considered) * 100) : 0,
          isViewer: member.id === userId,
        };
      })
      .sort((a, b) => b.completed - a.completed || b.share - a.share);

    const byType = TYPES.map((type) => ({
      type,
      label: getTypePluralLabel(type),
      count: items.filter((item) => item.type === type).length,
    })).filter((row) => row.count > 0);

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - (MONTHS - 1));
    const buckets = Array.from({ length: MONTHS }, (_, offset) => {
      const date = new Date(start);
      date.setMonth(start.getMonth() + offset);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        // Pinned locale: the server and the browser pick different defaults,
        // and a mismatched label discards the hydrated tree.
        month: date.toLocaleDateString('en-GB', { month: 'short' }),
        full: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        added: 0,
        movie: 0,
        tv_series: 0,
        book: 0,
        video_game: 0,
      };
    });
    const position = new Map(buckets.map((bucket, i) => [bucket.key, i]));
    for (const item of items) {
      const date = new Date(item.created_at);
      const slot = position.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (slot === undefined) continue;
      buckets[slot].added += 1;
      buckets[slot][item.type] += 1;
    }

    return { finishedByEveryone, addedRecently, onYou, roster, byType, buckets };
  }, [consumedSet, items, memberIds, members, notInterestedByItem, userId]);

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-stone-900 p-8 text-center border border-white/[0.07]">
        <h3 className="text-[15px] font-semibold text-stone-100">Nothing to count yet</h3>
        <p className="mt-1 text-sm text-stone-500">
          Add the first title and this page starts keeping score.
        </p>
      </div>
    );
  }

  // The bars are drawn at a fixed pitch rather than stretched to fit, so three
  // members and thirty members both get a readable row.
  const rosterHeight = Math.max(140, stats.roster.length * 34 + 16);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Progress"
          caption="Where the group is, and where each member is. Opt-outs are left out of that member's total."
        >
          {/*
            A number in a box of its own says nothing about what it counts or
            what it counts out of. The same number at the head of the chart it
            summarises says both: the group has finished this many of these, and
            the bars underneath are who did what.
          */}
          <Headline value={stats.finishedByEveryone} tone="good">
            of {items.length} finished by everyone
          </Headline>
          <div
            className="mt-3 h-[6px] overflow-hidden rounded-full bg-[var(--chart-grid)]"
            role="presentation"
          >
            <div
              className="h-full rounded-full bg-[var(--chart-progress)]"
              style={{
                width: `${items.length ? (stats.finishedByEveryone / items.length) * 100 : 0}%`,
              }}
            />
          </div>

          <ChartContainer
            config={PROGRESS_CONFIG}
            className="mt-4"
            style={{ height: rosterHeight }}
          >
            <BarChart
              data={stats.roster}
              layout="vertical"
              margin={{ top: 0, right: 34, bottom: 0, left: 0 }}
              barCategoryGap={10}
            >
              {/* Every bar is read against the same total. Scaling to the
                  best member instead would repaint the whole chart whenever
                  one person finished something, and would draw the leader as
                  "done" however much is left. */}
              <XAxis type="number" hide domain={[0, Math.max(1, items.length)]} />
              <YAxis
                type="category"
                dataKey="name"
                width={86}
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 12.5 }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_label, payload) => {
                      const row = payload[0]?.payload as (typeof stats.roster)[number] | undefined;
                      return row ? `${row.name} · ${row.share}% done` : '';
                    }}
                    valueFormatter={(value, _key, entry) => {
                      const row = entry.payload as (typeof stats.roster)[number] | undefined;
                      return row ? `${value} of ${row.considered}` : `${value}`;
                    }}
                  />
                }
              />
              <Bar
                dataKey="completed"
                // Bars that grow on arrival are a thing to watch; these are a
                // thing to read. They are also the difference between a chart
                // that is there when the page paints and one that is not.
                isAnimationActive={false}
                fill="var(--color-completed)"
                radius={[0, 4, 4, 0]}
                // The track is the rest of the archive: the bar is always read
                // against the total, never on its own.
                background={{ fill: 'var(--chart-grid)', radius: 4 }}
                maxBarSize={14}
              >
                <LabelList
                  dataKey="completed"
                  position="right"
                  offset={8}
                  className="fill-stone-400"
                  fontSize={11.5}
                />
              </Bar>
            </BarChart>
          </ChartContainer>

          <p className="mt-3 border-t border-white/[0.07] pt-3 text-[12.5px] text-stone-500">
            {stats.onYou > 0
              ? `${stats.onYou} ${stats.onYou === 1 ? 'title is' : 'titles are'} still waiting on you`
              : 'Nothing is waiting on you'}
          </p>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Collection"
          caption="Titles by kind. These four colours mean the same thing everywhere in the app."
        >
          <div className="relative">
            <ChartContainer config={TYPE_CONFIG} style={{ height: 172 }}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel valueFormatter={(v) => `${v} titles`} />}
                />
                <Pie
                  isAnimationActive={false}
                  data={stats.byType}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={50}
                  outerRadius={72}
                  // One kind of thing is a ring, not a pie chart with a slice
                  // missing: the gap only means something when there is a
                  // neighbour on the other side of it.
                  paddingAngle={stats.byType.length > 1 ? 2 : 0}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {stats.byType.map((row) => (
                    <Cell key={row.type} fill={`var(--chart-${row.type})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            {/* The hole is where the total belongs: the ring answers "of what?". */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-stone-50"
                style={{ fontVariationSettings: '"opsz" 48' }}
              >
                {items.length}
              </span>
              <span className="mt-1 text-[11.5px] text-stone-500">titles</span>
            </div>
          </div>

          {/*
            Not a legend — a reading of the ring. A legend names the slices that
            happen to exist; this names all four kinds every time, so a zero is
            something the archive says rather than something it leaves out, and
            every arc has its count written next to it instead of in a tooltip
            nobody on a phone can open.
          */}
          <ul className="mt-3 space-y-1.5">
            {TYPES.map((type) => {
              const Icon = TYPE_ICONS[type];
              const count = stats.byType.find((row) => row.type === type)?.count ?? 0;
              return (
                <li key={type} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: `var(--chart-${type})`, opacity: count > 0 ? 1 : 0.3 }}
                  />
                  <Icon className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                  <span className="truncate text-stone-400">{getTypePluralLabel(type)}</span>
                  <span
                    className={`ml-auto font-semibold tabular-nums ${count > 0 ? 'text-stone-200' : 'text-stone-600'}`}
                  >
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Activity"
        caption="Titles added each month over the last year. Point at a column for the count."
      >
        <Headline value={stats.addedRecently}>in the last 30 days</Headline>
        <ChartContainer config={VOLUME_CONFIG} className="mt-3" style={{ height: 176 }}>
          <BarChart data={stats.buckets} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="month"
              tickLine={false}
              // The months sit ON a baseline: an empty month has to read as a
              // month with nothing in it, not as a month that is missing.
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={{ fill: 'rgba(63,63,70,0.35)', radius: 6 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => {
                    const row = payload[0]?.payload as (typeof stats.buckets)[number] | undefined;
                    return row?.full ?? '';
                  }}
                  valueFormatter={(value) => `${value}`}
                />
              }
            />
            <Bar dataKey="added" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={30}>
              {stats.buckets.map((bucket) => (
                <Cell
                  key={bucket.key}
                  // An empty month is still a month: it keeps a flat neutral
                  // stub so the gap reads as "nothing added" rather than as a
                  // missing column.
                  fill={bucket.added === 0 ? 'var(--chart-grid)' : 'var(--color-added)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </Panel>
    </div>
  );
}

/**
 * A count and what it counts, on one baseline, reading as a sentence. The
 * number is large enough to be the thing you see first and the words are close
 * enough to be read in the same glance, which is the whole difference between
 * this and a tile with a label under it.
 */
function Headline({
  value,
  tone,
  children,
}: {
  value: number;
  tone?: 'good';
  children: React.ReactNode;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={`text-[30px] font-semibold leading-none tracking-[-0.03em] ${
          tone === 'good' ? 'text-emerald-400' : 'text-stone-50'
        }`}
        style={{ fontVariationSettings: '"opsz" 64' }}
      >
        {value}
      </span>
      <span className="text-[13.5px] text-stone-400">{children}</span>
    </p>
  );
}

function Panel({
  title,
  caption,
  className,
  children,
}: {
  title: string;
  caption: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] bg-stone-900 p-4 border border-white/[0.07] ${className ?? ''}`}
    >
      <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-stone-100">{title}</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] leading-snug text-stone-500">{caption}</p>
      {children}
    </section>
  );
}
