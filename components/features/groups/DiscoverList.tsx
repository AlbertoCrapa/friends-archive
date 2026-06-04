'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { JoinGroupSubmitButton } from './JoinGroupSubmitButton';
import { Globe, Users, BookOpen } from 'lucide-react';

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
}

interface Props {
  groups: DiscoverGroup[];
  isAuthenticated: boolean;
  joinGroup: (groupId: string) => Promise<void>;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function DiscoverList({ groups, isAuthenticated, joinGroup }: Props) {
  return (
    <div className="space-y-10">
      {/* Header — editorial feel, distinct from "My Archives" */}
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
        <div className="space-y-0 border border-stone-800/50 divide-y divide-stone-800/40">
          {groups.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.04, 0.28) }}
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
                  <form action={joinGroup.bind(null, group.id)}>
                    <JoinGroupSubmitButton />
                  </form>
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
      )}
    </div>
  );
}
