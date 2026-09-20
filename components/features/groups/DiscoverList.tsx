'use client';

// ============================================================================
// DiscoverList — public archives, browsed the way you would browse a shelf.
//
// The old version was a text list: names, then a line of counts. But nothing
// tells you whether you want to join "Tuesday Horror Club" faster than looking
// at what is already on its shelf, so each card here is built out of that
// group's own covers and the mix of things it keeps.
// ============================================================================

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Globe, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { RubberSegment } from '@/components/micro/RubberSegment';
import { RequestAccessSubmitButton } from './RequestAccessSubmitButton';
import { requestGroupAccess } from '@/app/actions/join-requests';
import { TYPE_ICONS } from '@/components/features/media/MediaPoster';
import { safeImageUrl } from '@/lib/utils';
import { getTypePluralLabel } from '@/types';
import type { JoinRequestStatus, MediaType } from '@/types';

interface DiscoverGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
  ownerNickname: string | null;
  memberCount: number;
  itemCount: number;
  isMember: boolean;
  /** Current user's access request for this group; null when none exists */
  requestStatus: JoinRequestStatus | null;
  typeCounts: Record<MediaType, number>;
  covers: string[];
}

interface Props {
  groups: DiscoverGroup[];
  isAuthenticated: boolean;
}

const EASE = [0.23, 1, 0.32, 1] as const;
const PAGE_SIZE = 12;
const TYPES: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];

type SortKey = 'active' | 'newest' | 'members' | 'items' | 'name';
type MembershipFilter = 'all' | 'open' | 'joined';

const SORTERS: Record<SortKey, (a: DiscoverGroup, b: DiscoverGroup) => number> = {
  active: (a, b) => b.itemCount + b.memberCount - (a.itemCount + a.memberCount),
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  members: (a, b) => b.memberCount - a.memberCount,
  items: (a, b) => b.itemCount - a.itemCount,
  name: (a, b) => a.name.localeCompare(b.name),
};

const SORT_OPTIONS = [
  { value: 'active', label: 'Most active' },
  { value: 'newest', label: 'Newest' },
  { value: 'members', label: 'Most members' },
  { value: 'items', label: 'Most titles' },
  { value: 'name', label: 'A to Z' },
];

export function DiscoverList({ groups, isAuthenticated }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('active');
  const [membership, setMembership] = useState<MembershipFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const joinedCount = useMemo(() => groups.filter((group) => group.isMember).length, [groups]);

  const matchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (group: DiscoverGroup) =>
      !q ||
      group.name.toLowerCase().includes(q) ||
      (group.description ?? '').toLowerCase().includes(q) ||
      (group.ownerNickname ?? '').toLowerCase().includes(q);
  }, [query]);

  const filtered = useMemo(
    () =>
      groups
        .filter((group) => {
          if (membership === 'open' && group.isMember) return false;
          if (membership === 'joined' && !group.isMember) return false;
          return matchesQuery(group);
        })
        .sort(SORTERS[sort]),
    [groups, membership, matchesQuery, sort],
  );

  const visible = filtered.slice(0, visibleCount);

  function countFor(filter: MembershipFilter) {
    return groups.filter((group) => {
      if (filter === 'open' && group.isMember) return false;
      if (filter === 'joined' && !group.isMember) return false;
      return matchesQuery(group);
    }).length;
  }

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="page-title">Discover</h1>
          <p className="mt-1 text-[13.5px] text-stone-500">
            {groups.length === 0
              ? 'Public archives anyone can look inside.'
              : `${groups.length} public ${groups.length === 1 ? 'archive' : 'archives'}${
                  joinedCount > 0 ? `, ${joinedCount} you are in` : ''
                }.`}
          </p>
        </div>
      </motion.header>

      {groups.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-stone-900 px-8 py-20 text-center border border-white/[0.07]">
          <Globe className="mx-auto h-7 w-7 text-stone-700" aria-hidden />
          <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-stone-100">
            No public archives yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-stone-500">
            Make one public and it shows up here for everyone.
          </p>
          <Link href="/groups/new" className="mt-6 inline-flex">
            <Button size="sm">Create a public archive</Button>
          </Link>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.08 }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search by name, topic or owner"
                aria-label="Search public archives"
                className="h-9 pl-9 pr-8 text-[13px]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-[var(--radius-sm)] p-1 text-stone-500 hover:text-stone-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <RubberSegment
              ariaLabel="Filter by membership"
              value={membership}
              onChange={(next) => {
                setMembership(next as MembershipFilter);
                setVisibleCount(PAGE_SIZE);
              }}
              options={[
                { value: 'all', label: 'All', count: countFor('all') },
                { value: 'open', label: 'Not joined', count: countFor('open') },
                { value: 'joined', label: 'Joined', count: countFor('joined') },
              ]}
            />

            <GlideSelect
              label="Order"
              align="right"
              value={sort}
              onChange={(next) => setSort(next as SortKey)}
              options={SORT_OPTIONS}
            />
          </motion.div>

          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] bg-stone-900 px-8 py-16 text-center border border-white/[0.07]">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-stone-100">
                Nothing matches
              </h2>
              <p className="mt-1 text-[13.5px] text-stone-500">
                Try a shorter search, or switch the filter back to All.
              </p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((group, i) => (
                  <motion.li
                    key={group.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.035, 0.28) }}
                  >
                    <DiscoverCard group={group} isAuthenticated={isAuthenticated} />
                  </motion.li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] text-stone-500">
                  Showing {visible.length} of {filtered.length}
                </p>
                {filtered.length > visibleCount ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Show more
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DiscoverCard({
  group,
  isAuthenticated,
}: {
  group: DiscoverGroup;
  isAuthenticated: boolean;
}) {
  const covers = group.covers.map(safeImageUrl).filter(Boolean) as string[];
  const total = TYPES.reduce((sum, type) => sum + (group.typeCounts[type] ?? 0), 0);
  const present = TYPES.filter((type) => (group.typeCounts[type] ?? 0) > 0);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-stone-900 border border-white/[0.07] transition-[border-color] duration-[var(--duration-standard)] ease-[var(--ease-standard)] hover:border-white/25">
      <Link href={`/groups/${group.id}`} className="group block">
        <div className="relative h-[78px] overflow-hidden bg-stone-800">
          {covers.length > 0 ? (
            <div className="flex h-full scale-[1.03] opacity-80 transition-[opacity,scale] duration-[var(--duration-drift)] ease-[var(--ease-drift)] group-hover:scale-[1.06] group-hover:opacity-100">
              {covers.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full min-w-0 flex-1 object-cover"
                />
              ))}
            </div>
          ) : null}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/45 to-stone-900/10" />
          {group.isMember ? (
            <span className="absolute right-2 top-2 rounded-[var(--radius-sm)] bg-emerald-500/90 px-1.5 py-0.5 text-[11px] font-semibold text-stone-950">
              Joined
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
        <Link href={`/groups/${group.id}`} className="group">
          <h2 className="line-clamp-2 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-stone-50 transition-colors group-hover:text-amber-300">
            {group.name}
          </h2>
        </Link>

        {group.description ? (
          <p className="line-clamp-2 text-[12.5px] leading-snug text-stone-500">
            {group.description}
          </p>
        ) : null}

        {total > 0 ? (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {present.map((type) => {
              const Icon = TYPE_ICONS[type];
              return (
                <li
                  key={type}
                  className="flex items-center gap-1 text-[11.5px] text-stone-400"
                  title={getTypePluralLabel(type)}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-[3px]"
                    style={{ background: `var(--chart-${type})` }}
                  />
                  <Icon className="h-3 w-3 text-stone-500" aria-hidden />
                  <span className="tabular-nums">{group.typeCounts[type]}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-stone-600">Nothing on the shelf yet</p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-2 text-[12px] text-stone-500">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {group.memberCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {group.itemCount}
          </span>
          {group.ownerNickname ? (
            <Link
              href={`/profile/${group.ownerNickname}`}
              className="ml-auto truncate text-[12px] text-stone-500 transition-colors hover:text-stone-200"
            >
              {group.ownerNickname}
            </Link>
          ) : null}
        </div>

        <div className="pt-1">
          {group.isMember ? (
            <Link href={`/groups/${group.id}`} className="block">
              <Button variant="secondary" size="sm" className="w-full">
                Open archive
              </Button>
            </Link>
          ) : isAuthenticated ? (
            group.requestStatus === 'pending' ? (
              <span className="flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-stone-800/60 text-[12.5px] text-stone-400">
                <Clock className="h-3.5 w-3.5" />
                Request sent
              </span>
            ) : (
              <form action={requestGroupAccess.bind(null, group.id)}>
                <RequestAccessSubmitButton
                  variant="default"
                  className="w-full"
                  label={group.requestStatus === 'declined' ? 'Ask again' : 'Ask to join'}
                />
              </form>
            )
          ) : (
            <Link href={`/groups/${group.id}`} className="block">
              <Button variant="secondary" size="sm" className="w-full">
                Look inside
              </Button>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
