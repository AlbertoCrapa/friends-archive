'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Lock, ArrowLeft, Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Group {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  created_at: string;
  role: string;
  itemCount: number;
}

interface Profile {
  id: string;
  nickname: string;
  created_at: string;
}

interface Props {
  profile: Profile;
  isOwnProfile: boolean;
  visibleGroups: Group[];
  ownedCount: number;
  consumedCount: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: EASE, delay: i * 0.045 },
  }),
};

export function ProfileContent({
  profile,
  isOwnProfile,
  visibleGroups,
  ownedCount,
  consumedCount,
}: Props) {
  return (
    <div className="max-w-2xl space-y-12">
      {/* Back nav */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Button>
        </Link>
      </motion.div>

      {/* Profile header */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.06 }}
      >
        <div className="space-y-2">
          <p
            className="font-mono text-xs uppercase tracking-[0.3em]"
            style={{ color: 'oklch(0.72 0.12 65 / 0.6)' }}
          >
            {isOwnProfile ? 'Your profile' : 'Member profile'}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-100 font-light">
            {profile.nickname}
          </h1>
          <p
            className="font-mono text-xs"
            style={{ color: 'oklch(0.38 0.005 60)' }}
          >
            Member since {formatDate(profile.created_at)}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-stretch gap-0 border border-stone-800/50 overflow-hidden">
          {[
            { label: 'Archives', value: visibleGroups.length },
            { label: 'Owned', value: ownedCount },
            { label: 'Consumed', value: consumedCount },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="flex-1 px-5 py-4 space-y-1 border-r border-stone-800/50 last:border-r-0"
              style={i === 0 ? { backgroundColor: 'var(--color-surface)' } : {}}
            >
              <p className="font-serif text-2xl text-stone-100">{stat.value}</p>
              <p
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: 'oklch(0.4 0.005 60)' }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Archives list */}
      <section className="space-y-5">
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2
            className="font-mono text-xs uppercase tracking-[0.3em]"
            style={{ color: 'oklch(0.42 0.005 60)' }}
          >
            {isOwnProfile ? 'Your archives' : 'Public archives'}
            <span className="ml-2" style={{ color: 'oklch(0.32 0.005 60)' }}>
              ({visibleGroups.length})
            </span>
          </h2>
          {isOwnProfile && (
            <Link href="/groups/new">
              <Button variant="ghost" size="sm" className="gap-1.5 -mr-2">
                <Plus className="h-3 w-3" />
                New group
              </Button>
            </Link>
          )}
        </motion.div>

        {visibleGroups.length === 0 ? (
          <motion.div
            className="border border-stone-800/50 py-16 text-center space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <p className="font-serif text-xl" style={{ color: 'oklch(0.38 0.005 60)' }}>
              {isOwnProfile ? 'No archives yet' : 'No public archives'}
            </p>
            {isOwnProfile && (
              <div className="flex justify-center pt-2">
                <Link href="/groups/new">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-3.5 w-3.5" />
                    Create a group
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="border border-stone-800/50">
            {visibleGroups.map((g, i) => (
              <motion.div
                key={g.id}
                custom={i}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                className="border-b border-stone-800/30 last:border-b-0"
              >
                <Link
                  href={`/groups/${g.id}`}
                  className="group flex items-start justify-between gap-4 px-5 py-4 hover:bg-stone-900/30 transition-colors cursor-pointer"
                >
                  {/* Left */}
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-serif text-base text-stone-100 group-hover:text-amber-400 transition-colors leading-snug">
                        {g.name}
                      </span>
                      {g.visibility === 'public' ? (
                        <Badge variant="public" className="gap-1 shrink-0">
                          <Globe className="h-2.5 w-2.5" /> Public
                        </Badge>
                      ) : (
                        <Badge variant="private" className="gap-1 shrink-0">
                          <Lock className="h-2.5 w-2.5" /> Private
                        </Badge>
                      )}
                    </div>
                    {g.description && (
                      <p
                        className="text-sm font-light line-clamp-1"
                        style={{ color: 'oklch(0.42 0.005 60)' }}
                      >
                        {g.description}
                      </p>
                    )}
                  </div>

                  {/* Right meta */}
                  <div className="shrink-0 text-right space-y-1">
                    <p
                      className="font-mono text-xs"
                      style={{ color: 'oklch(0.38 0.005 60)' }}
                    >
                      {g.itemCount} item{g.itemCount !== 1 ? 's' : ''}
                    </p>
                    <p
                      className="font-mono text-[10px] uppercase tracking-wider"
                      style={{
                        color:
                          g.role === 'owner'
                            ? 'var(--color-accent)'
                            : 'oklch(0.36 0.005 60)',
                      }}
                    >
                      {g.role}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Open source notice */}
      <motion.div
        className="border-t border-stone-800/40 pt-6 text-center space-y-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <p
          className="font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: 'oklch(0.72 0.12 65 / 0.5)' }}
        >
          Free &amp; open source
        </p>
        <p className="font-mono text-[11px]" style={{ color: 'oklch(0.36 0.005 60)' }}>
          The Friend Archive is a free hobby project — no paid plans, no commercial use intended.
        </p>
      </motion.div>
    </div>
  );
}
