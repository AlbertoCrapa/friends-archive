'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JoinGroupSubmitButton } from './JoinGroupSubmitButton';
import { Globe, Plus } from 'lucide-react';

interface DiscoverGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
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

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE, delay: i * 0.055 },
  }),
};

export function DiscoverGrid({ groups, isAuthenticated, joinGroup }: Props) {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h1 className="font-serif text-3xl sm:text-4xl text-stone-100">Discover</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">
          Browse public archives from the community.
          {groups.length > 0 && (
            <span className="ml-2">{groups.length} archive{groups.length !== 1 ? 's' : ''}</span>
          )}
        </p>
      </motion.div>

      {groups.length === 0 ? (
        <motion.div
          className="border border-stone-800/50 py-24 text-center space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
        >
          <p className="font-serif text-2xl text-stone-500">No public archives yet</p>
          <p className="text-stone-600 text-sm font-mono">
            Be the first to create a public archive.
          </p>
          <Link href="/groups/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Create a group
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group, i) => (
            <motion.div
              key={group.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border border-stone-800/50 p-5 space-y-3 flex flex-col transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)] hover:border-amber-800/50 hover:bg-stone-900/30 hover:shadow-[var(--shadow-2)] hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/groups/${group.id}`} className="group min-w-0">
                  <h2 className="font-serif text-lg text-stone-100 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                    {group.name}
                  </h2>
                </Link>
                <Badge variant="public" className="shrink-0 gap-1">
                  <Globe className="h-2.5 w-2.5" /> Public
                </Badge>
              </div>

              {group.description && (
                <p className="text-stone-500 text-sm font-light line-clamp-2 flex-1">
                  {group.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 mt-auto">
                <div
                  className="flex items-center gap-3 text-xs font-mono"
                  style={{ color: 'oklch(0.4 0.005 60)' }}
                >
                  <span>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{group.itemCount} item{group.itemCount !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  {group.isMember ? (
                    <Link href={`/groups/${group.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  ) : isAuthenticated ? (
                    <form action={joinGroup.bind(null, group.id)}>
                      <JoinGroupSubmitButton />
                    </form>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
