import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupMediaLoader } from '@/components/features/media/GroupMediaLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Globe, Lock, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import type { GroupRole, MediaType } from '@/types';

interface Props {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ type?: 'all' | MediaType; page?: string }>;
}

const TAB_LABELS = ['All', 'Movies', 'TV', 'Books', 'Games'];
const STATUS_LABELS = ['Any status', 'Planned', 'In progress', 'Completed'];

function MediaSectionSkeleton({ isMember }: { isMember: boolean }) {
  return (
    <div className="space-y-0">
      {/* Sticky control bar — rendered with real labels so it feels instant */}
      <div className="sticky top-[56px] z-20 bg-stone-950/96 backdrop-blur-sm border-b border-stone-900 -mx-6 px-6 pb-0">
        {/* Type tabs */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-0 overflow-x-auto overflow-y-hidden scrollbar-hide">
            {TAB_LABELS.map((label, i) => (
              <div
                key={label}
                className={`min-h-[44px] px-3 sm:px-4 py-2 text-xs sm:text-sm font-mono uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap select-none ${
                  i === 0 ? 'text-amber-500 border-amber-500' : 'text-stone-600 border-transparent'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          {isMember && <Skeleton className="h-9 w-28 shrink-0" />}
        </div>
        {/* Search + status filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 py-2.5">
          <Skeleton className="h-9 w-full sm:w-64 max-w-xs" />
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {STATUS_LABELS.map((label) => (
              <div
                key={label}
                className="min-h-9 px-3 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap border border-stone-800/60 text-stone-700 select-none"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton only */}
      <div className="border border-stone-800/50 mt-4">
        <div className="hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 px-4 py-3 border-b border-stone-800/60">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-stone-800/30 hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 items-start">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-7 ml-auto" />
          </div>
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`m${i}`} className="md:hidden p-4 border-b border-stone-800/30 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function GroupDetailPage({ params, searchParams }: Props) {
  const { groupId } = await params;
  const { type: rawType, page: rawPage } = await searchParams;
  const activeType = rawType ?? 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: group }, { data: membership }, { count: memberCount }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, description, visibility, owner_id, created_at')
      .eq('id', groupId)
      .single(),
    supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', groupId),
  ]);

  if (!group) notFound();

  const isMember = !!membership;
  const role: GroupRole | null = membership?.role ?? null;
  const isOwner = role === 'owner';

  if (!isMember && group.visibility === 'private') notFound();

  const validTypes = new Set(['all', 'movie', 'tv_series', 'book', 'video_game']);
  const initialActiveType = validTypes.has(activeType) ? activeType : 'all';
  const parsedPage = Number(rawPage);
  const initialPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return (
    <div className="space-y-8">
      {/* Group header — renders immediately */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <Link href={isMember ? '/dashboard' : '/discover'}>
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              {isMember ? 'Dashboard' : 'Discover'}
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-3xl text-stone-100">{group.name}</h1>
            {group.visibility === 'public' ? (
              <Badge variant="public" className="gap-1 shrink-0">
                <Globe className="h-2.5 w-2.5" /> Public
              </Badge>
            ) : (
              <Badge variant="private" className="gap-1 shrink-0">
                <Lock className="h-2.5 w-2.5" /> Private
              </Badge>
            )}
          </div>
          {group.description && (
            <p className="text-stone-500 text-sm font-light">{group.description}</p>
          )}
          <p className="text-xs font-mono text-stone-600 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {memberCount ?? 0} member{memberCount !== 1 ? 's' : ''}
            {!isMember && (
              <span className="ml-2 text-stone-700">· Read-only</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <Link href={`/groups/${groupId}/settings`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Settings className="h-3 w-3" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Media section — streams in with skeleton */}
      <Suspense fallback={<MediaSectionSkeleton isMember={isMember} />}>
        <GroupMediaLoader
          groupId={groupId}
          userId={user.id}
          isMember={isMember}
          initialActiveType={initialActiveType as 'all' | MediaType}
          initialPage={initialPage}
        />
      </Suspense>
    </div>
  );
}
