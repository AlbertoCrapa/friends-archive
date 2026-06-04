'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Lock, Globe, Compass } from 'lucide-react';
import type { Group, GroupRole } from '@/types';

type GroupRow = Group & { role: GroupRole; itemCount: number; memberCount: number };

interface Props {
  groups: GroupRow[];
  ownedCount: number;
  atLimit: boolean;
  plan: string;
  totalItems: number;
  consumedCount: number;
  addedCount: number;
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

export function DashboardContent({ groups, ownedCount, atLimit, plan, totalItems, consumedCount, addedCount }: Props) {
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

      {/* Stats strip */}
      {groups.length > 0 && (
        <motion.div
          className="grid grid-cols-3 border border-stone-800/50 divide-x divide-stone-800/50"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE, delay: 0.1 }}
        >
          {[
            { value: totalItems, label: 'total items' },
            { value: consumedCount, label: 'consumed' },
            { value: addedCount, label: 'added by me' },
          ].map(({ value, label }) => (
            <div key={label} className="px-4 sm:px-6 py-4 text-center">
              <p className="font-serif text-2xl sm:text-3xl text-stone-100">{value}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-stone-600 mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Groups grid */}
      {groups.length === 0 ? (
        <EmptyState />
      ) : (
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
                    <h2 className="font-serif text-lg text-stone-100 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                      {group.name}
                    </h2>
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
