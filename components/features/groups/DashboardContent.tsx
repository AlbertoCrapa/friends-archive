'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Lock, Globe, Compass } from 'lucide-react';
import type { Group, GroupRole, ItemStatus, MediaType } from '@/types';
import { getTypeLabel, getTypePluralLabel } from '@/types';

type GroupRow = Group & { role: GroupRole; itemCount: number; memberCount: number };

interface RecentItem {
  id: string;
  title: string;
  type: MediaType;
  groupId: string;
  groupName: string;
  createdAt: string;
}

interface Props {
  groups: GroupRow[];
  ownedCount: number;
  atLimit: boolean;
  plan: string;
  maxOwned: number | null;
  totalItems: number;
  consumedCount: number;
  addedCount: number;
  typeCounts: Record<MediaType, number>;
  statusCounts: Record<ItemStatus, number>;
  recentItems: RecentItem[];
}

const EASE = [0.22, 1, 0.36, 1] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE, delay: i * 0.055 },
  }),
};

const MEDIA_TYPE_ORDER: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];

function formatDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function DashboardContent({
  groups,
  ownedCount,
  atLimit,
  plan,
  maxOwned,
  totalItems,
  consumedCount,
  addedCount,
  typeCounts,
  statusCounts,
  recentItems,
}: Props) {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <motion.div
        className="flex items-start justify-between gap-4 flex-wrap"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-stone-100">My Archives</h1>
          <p className="text-stone-500 text-sm font-mono mt-1">
            {groups.length} group{groups.length !== 1 ? 's' : ''} · {ownedCount} owned
            {plan !== 'free' && (
              <span
                className="ml-3 uppercase tracking-wider text-[10px] px-1.5 py-0.5 border"
                style={{
                  borderColor: 'oklch(0.55 0.12 60 / 0.4)',
                  color: 'var(--color-accent)',
                }}
              >
                {plan}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit ? (
            <Link href="/pricing">
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Upgrade for more groups
              </Button>
            </Link>
          ) : (
            <Link href="/groups/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                New group
              </Button>
            </Link>
          )}
        </div>
      </motion.div>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Overview stats */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 border border-stone-800/50 divide-x divide-y sm:divide-y-0 divide-stone-800/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
          >
            {[
              { value: groups.length, label: 'groups' },
              { value: totalItems, label: 'total items' },
              { value: consumedCount, label: 'consumed by me' },
              { value: addedCount, label: 'added by me' },
            ].map(({ value, label }) => (
              <div key={label} className="px-4 sm:px-6 py-4 text-center">
                <p className="font-serif text-2xl sm:text-3xl text-stone-100">{value}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-stone-600 mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>

          {/* Breakdown + recent activity */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.16 }}
          >
            {/* Library breakdown */}
            <div className="border border-stone-800/50 p-5 sm:p-6 space-y-5">
              <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>
                Library breakdown
              </h2>
              <div className="space-y-3.5">
                {MEDIA_TYPE_ORDER.map((type) => {
                  const count = typeCounts[type] ?? 0;
                  const pct = totalItems > 0 ? (count / totalItems) * 100 : 0;
                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">
                          {getTypePluralLabel(type)}
                        </span>
                        <span className="font-mono text-[11px] text-stone-500">{count}</span>
                      </div>
                      <div className="h-1.5 w-full" style={{ backgroundColor: 'oklch(0.2 0.005 60)' }}>
                        <div
                          className="h-full transition-[width] duration-700 ease-[var(--ease-emphasized)]"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: 'oklch(0.62 0.13 60 / 0.85)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Group progress */}
              <div className="pt-1 flex items-center gap-4 flex-wrap">
                {[
                  { label: 'completed', count: statusCounts.completed, color: 'oklch(0.72 0.14 160)' },
                  { label: 'in progress', count: statusCounts.consuming, color: 'oklch(0.78 0.13 62)' },
                  { label: 'planned', count: statusCounts.plan_to_consume, color: 'oklch(0.42 0.005 60)' },
                ].map(({ label, count, color }) => (
                  <span key={label} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                    <span className="w-1.5 h-1.5 rotate-45 shrink-0" style={{ backgroundColor: color }} />
                    {count} {label}
                  </span>
                ))}
              </div>

              {/* Plan usage */}
              {maxOwned !== null && (
                <div className="border-t border-stone-800/40 pt-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-stone-600">
                      Owned groups · {plan} plan
                    </span>
                    <span className="font-mono text-[11px] text-stone-500">
                      {ownedCount} / {maxOwned}
                    </span>
                  </div>
                  <div className="h-1.5 w-full" style={{ backgroundColor: 'oklch(0.2 0.005 60)' }}>
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min((ownedCount / maxOwned) * 100, 100)}%`,
                        backgroundColor: atLimit ? 'oklch(0.62 0.18 30 / 0.85)' : 'oklch(0.62 0.13 60 / 0.85)',
                      }}
                    />
                  </div>
                  {atLimit && (
                    <p className="font-mono text-[10px] text-stone-600">
                      Limit reached. <Link href="/pricing" className="hover:underline">See plans</Link>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Recent additions */}
            <div className="border border-stone-800/50 p-5 sm:p-6 space-y-5">
              <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>
                Recent additions
              </h2>
              {recentItems.length === 0 ? (
                <p className="text-stone-600 text-sm font-light py-6 text-center">
                  Nothing added yet. Open a group and add the first title.
                </p>
              ) : (
                <ul className="-my-1">
                  {recentItems.map((item) => (
                    <li key={item.id} className="border-b border-stone-800/30 last:border-b-0">
                      <Link
                        href={`/groups/${item.groupId}`}
                        className="flex items-center gap-4 py-2.5 group/recent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-stone-200 font-light truncate group-hover/recent:text-amber-400 transition-colors">
                            {item.title}
                          </p>
                          <p className="font-mono text-[10px] text-stone-600 truncate mt-0.5">
                            {item.groupName}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-600 shrink-0 hidden sm:block">
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="font-mono text-[10px] text-stone-600 shrink-0">
                          {formatDay(item.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>

          {/* Groups grid */}
          <div className="space-y-4">
            <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>
              Your groups
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group, i) => (
                <motion.div
                  key={group.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Link href={`/groups/${group.id}`} className="group block cursor-pointer h-full">
                    <div className="h-full border border-stone-800/50 p-5 hover:border-amber-800/50 hover:bg-stone-900/30 hover:shadow-[var(--shadow-2)] hover:-translate-y-0.5 transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)] space-y-3 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-lg text-stone-100 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                          {group.name}
                        </h3>
                        <div className="shrink-0">
                          {group.visibility === 'public' ? (
                            <Badge variant="public" className="gap-1">
                              <Globe className="h-2.5 w-2.5" /> Public
                            </Badge>
                          ) : (
                            <Badge variant="private" className="gap-1">
                              <Lock className="h-2.5 w-2.5" /> Private
                            </Badge>
                          )}
                        </div>
                      </div>

                      {group.description && (
                        <p className="text-stone-500 text-sm font-light line-clamp-2 flex-1">
                          {group.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 mt-auto">
                        <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'oklch(0.4 0.005 60)' }}>
                          <span>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span>{group.itemCount} item{group.itemCount !== 1 ? 's' : ''}</span>
                        </div>
                        <span
                          className="text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: group.role === 'owner' ? 'var(--color-accent)' : 'oklch(0.4 0.005 60)' }}
                        >
                          {group.role}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="border border-stone-800/50 py-24 px-8 text-center space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
    >
      <div className="space-y-3">
        <p className="font-serif text-2xl text-stone-500">No archives yet</p>
        <p className="text-stone-600 text-sm font-mono max-w-sm mx-auto">
          Create a group for your crew, or discover what others are archiving together.
        </p>
      </div>
      <div className="flex justify-center gap-3 flex-wrap">
        <Link href="/groups/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Create a group
          </Button>
        </Link>
        <Link href="/discover">
          <Button variant="outline" size="sm" className="gap-2">
            <Compass className="h-3.5 w-3.5" />
            Discover
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
