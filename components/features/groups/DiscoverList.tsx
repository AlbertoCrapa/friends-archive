'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RequestAccessSubmitButton } from './RequestAccessSubmitButton';
import { requestGroupAccess } from '@/app/actions/join-requests';
import { Globe, Users, BookOpen, Search, Flame, Clock } from 'lucide-react';
import type { JoinRequestStatus } from '@/types';

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
}

interface Props {
  groups: DiscoverGroup[];
  isAuthenticated: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const PAGE_SIZE = 12;

type SortKey = 'newest' | 'members' | 'items' | 'name';
type MembershipFilter = 'all' | 'open' | 'joined';

const SORTERS: Record<SortKey, (a: DiscoverGroup, b: DiscoverGroup) => number> = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  members: (a, b) => b.memberCount - a.memberCount,
  items: (a, b) => b.itemCount - a.itemCount,
  name: (a, b) => a.name.localeCompare(b.name),
};

export function DiscoverList({ groups, isAuthenticated }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [membership, setMembership] = useState<MembershipFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const joinedCount = useMemo(() => groups.filter((g) => g.isMember).length, [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => {
        if (membership === 'open' && g.isMember) return false;
        if (membership === 'joined' && !g.isMember) return false;
        if (!q) return true;
        return (
          g.name.toLowerCase().includes(q) ||
          (g.description ?? '').toLowerCase().includes(q) ||
          (g.ownerNickname ?? '').toLowerCase().includes(q)
        );
      })
      .sort(SORTERS[sort]);
  }, [groups, query, membership, sort]);

  const visible = filtered.slice(0, visibleCount);
  const isBrowsing = query.trim() === '' && membership === 'all';

  // Most active archives: shown only while browsing, once there is enough to curate
  const featured = useMemo(() => {
    if (!isBrowsing || groups.length < 6) return [];
    return [...groups].sort((a, b) => b.itemCount + b.memberCount - (a.itemCount + a.memberCount)).slice(0, 3);
  }, [groups, isBrowsing]);

  function updateFilters(next: { query?: string; membership?: MembershipFilter }) {
    if (next.query !== undefined) setQuery(next.query);
    if (next.membership !== undefined) setMembership(next.membership);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="border-b border-stone-800/60 pb-6"
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600 mb-2">Public archives</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-stone-100 leading-tight">Discover</h1>
          </div>
          {groups.length > 0 && (
            <p className="font-mono text-xs text-stone-600 pb-1">
              {groups.length} archive{groups.length !== 1 ? 's' : ''}
              {joinedCount > 0 && <span> · {joinedCount} joined</span>}
            </p>
          )}
        </div>
      </motion.div>

      {groups.length === 0 ? (
        <motion.div
          className="py-24 text-center space-y-5 border border-stone-800/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
        >
          <Globe className="h-8 w-8 mx-auto" style={{ color: 'oklch(0.35 0.005 60)' }} />
          <div className="space-y-2">
            <p className="font-serif text-2xl text-stone-500">No public archives yet</p>
            <p className="text-stone-600 text-sm font-mono">Be the first to create one.</p>
          </div>
          <Link href="/groups/new">
            <Button size="sm" className="gap-2">Create a public archive</Button>
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Most active strip */}
          {featured.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
              className="space-y-3"
            >
              <h2 className="flex items-center gap-2 font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>
                <Flame className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                Most active
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {featured.map((group) => (
                  <Link key={group.id} href={`/groups/${group.id}`} className="group block">
                    <div className="h-full border border-stone-800/50 p-4 space-y-2 hover:border-amber-800/50 hover:bg-stone-900/30 transition-all duration-[var(--duration-standard)]">
                      <h3 className="font-serif text-lg text-stone-100 group-hover:text-amber-400 transition-colors line-clamp-1 leading-snug">
                        {group.name}
                      </h3>
                      <div className="flex items-center gap-3 font-mono text-[10px] text-stone-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" /> {group.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-2.5 w-2.5" /> {group.itemCount}
                        </span>
                        {group.isMember && (
                          <span className="uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                            Joined
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Toolbar: search, membership filter, sort */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.14 }}
            className="flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-600 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => updateFilters({ query: e.target.value })}
                placeholder="Search by name, topic, or owner…"
                className="pl-9"
                aria-label="Search public archives"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex" role="group" aria-label="Filter by membership">
                {(
                  [
                    { value: 'all', label: 'All' },
                    { value: 'open', label: 'Not joined' },
                    { value: 'joined', label: 'Joined' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateFilters({ membership: value })}
                    className="min-h-10 px-3 font-mono text-[11px] uppercase tracking-wider border border-l-0 first:border-l transition-colors"
                    style={
                      membership === value
                        ? {
                            borderColor: 'oklch(0.55 0.12 60 / 0.5)',
                            color: 'var(--color-accent)',
                            backgroundColor: 'oklch(0.14 0.04 60 / 0.25)',
                          }
                        : { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-40" aria-label="Sort archives">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="members">Most members</SelectItem>
                  <SelectItem value="items">Most items</SelectItem>
                  <SelectItem value="name">A to Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="py-20 text-center border border-stone-800/50 space-y-2">
              <p className="font-serif text-xl text-stone-500">No archives match</p>
              <p className="text-stone-600 text-sm font-mono">Try a different search or filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-0 border border-stone-800/50 divide-y divide-stone-800/40">
                {visible.map((group, i) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.03, 0.24) }}
                    className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-stone-900/25 transition-colors group"
                  >
                    {/* Left: name + meta */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Link href={`/groups/${group.id}`} className="block">
                        <h2 className="font-serif text-lg sm:text-xl text-stone-200 group-hover:text-stone-100 transition-colors leading-snug line-clamp-1">
                          {group.name}
                        </h2>
                      </Link>
                      {group.description && (
                        <p className="text-stone-500 text-sm font-light line-clamp-1 leading-snug">
                          {group.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 pt-0.5">
                        {group.ownerNickname && (
                          <Link
                            href={`/profile/${group.ownerNickname}`}
                            className="font-mono text-[10px] text-stone-600 hover:text-stone-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {group.ownerNickname}
                          </Link>
                        )}
                        <span className="font-mono text-[10px] text-stone-700 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" />
                          {group.memberCount}
                        </span>
                        <span className="font-mono text-[10px] text-stone-700 flex items-center gap-1">
                          <BookOpen className="h-2.5 w-2.5" />
                          {group.itemCount}
                        </span>
                      </div>
                    </div>

                    {/* Right: action */}
                    <div className="shrink-0 flex items-center gap-2 pt-0.5">
                      {group.isMember ? (
                        <Link href={`/groups/${group.id}`}>
                          <Button variant="ghost" size="sm" className="text-stone-500 hover:text-stone-300 text-xs font-mono">
                            View
                          </Button>
                        </Link>
                      ) : isAuthenticated ? (
                        group.requestStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-stone-500 px-3 py-2">
                            <Clock className="h-3 w-3" />
                            Requested
                          </span>
                        ) : (
                          <form action={requestGroupAccess.bind(null, group.id)}>
                            <RequestAccessSubmitButton
                              label={group.requestStatus === 'declined' ? 'Request again' : 'Request to join'}
                            />
                          </form>
                        )
                      ) : (
                        <Link href={`/groups/${group.id}`}>
                          <Button variant="ghost" size="sm" className="text-stone-500 hover:text-stone-300 text-xs font-mono">
                            Browse
                          </Button>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Incremental loading for large communities */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="font-mono text-[11px] text-stone-600">
                  Showing {visible.length} of {filtered.length}
                </p>
                {filtered.length > visibleCount && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Show more
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
