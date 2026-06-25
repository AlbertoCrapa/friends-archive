import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupMediaLoader } from '@/components/features/media/GroupMediaLoader';
import { RequestAccessPanel } from '@/components/features/groups/RequestAccessPanel';
import { ShareGroupButton } from '@/components/features/groups/ShareGroupButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { ArrowLeft, Globe, Lock, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import type { JoinRequestStatus, MediaType } from '@/types';

interface Props {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ type?: 'all' | MediaType; page?: string }>;
}

function MediaSectionLoader() {
  return <PageLoader label="Loading catalogue" className="py-24" />;
}

export default async function GroupDetailPage({ params, searchParams }: Props) {
  const { groupId } = await params;
  const { type: rawType, page: rawPage } = await searchParams;
  const activeType = rawType ?? 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: group }, { data: membership }, { count: memberCount }, { data: joinRequest }] =
    await Promise.all([
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
      supabase
        .from('group_join_requests')
        .select('status')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

  if (!group) notFound();

  const isMember = !!membership;
  const requestStatus: JoinRequestStatus | null =
    (joinRequest?.status as JoinRequestStatus | undefined) ?? null;

  // Private group, non-member: the link reveals only the group's name.
  // Content stays blocked behind an access request the owner must approve.
  if (!isMember && group.visibility === 'private') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-6">
        <Lock className="h-8 w-8 mx-auto" style={{ color: 'oklch(0.35 0.005 60)' }} />
        <div className="space-y-2">
          <h1 className="font-serif text-3xl text-stone-100">{group.name}</h1>
          <Badge variant="private" className="gap-1">
            <Lock className="h-2.5 w-2.5" /> Private
          </Badge>
        </div>
        <p className="text-stone-500 text-sm font-light">
          This archive is private. Only members can see its contents. Request access and the
          owner will review your request.
        </p>
        <div className="flex justify-center">
          <RequestAccessPanel groupId={groupId} requestStatus={requestStatus} />
        </div>
        <Link href="/discover" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Discover
          </Button>
        </Link>
      </div>
    );
  }

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
          {!isMember && (
            <div className="pt-1">
              <RequestAccessPanel groupId={groupId} requestStatus={requestStatus} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareGroupButton groupId={groupId} groupName={group.name} />
          {isMember && (
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
      <Suspense fallback={<MediaSectionLoader />}>
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
