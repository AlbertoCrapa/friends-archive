import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupMediaLoader } from '@/components/features/media/GroupMediaLoader';
import { RequestAccessPanel } from '@/components/features/groups/RequestAccessPanel';
import { ShareGroupButton } from '@/components/features/groups/ShareGroupButton';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { ArrowLeft, Globe, Lock, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import type { JoinRequestStatus, MediaType } from '@/types';

interface Props {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ type?: 'all' | MediaType; page?: string; view?: string }>;
}

function MediaSectionLoader() {
  return <PageLoader label="Loading catalogue" className="py-24" />;
}

export default async function GroupDetailPage({ params, searchParams }: Props) {
  const { groupId } = await params;
  const { type: rawType, page: rawPage, view: rawView } = await searchParams;
  const activeType = rawType ?? 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: group }, { data: membership }, { data: memberRows }, { data: joinRequest }] =
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
      // The roster, not just its size: a group page should say who is in the
      // group, and six names cost the same round trip as one count.
      supabase
        .from('group_members')
        .select('user_id, profiles(nickname)')
        .eq('group_id', groupId),
      supabase
        .from('group_join_requests')
        .select('status')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

  if (!group) notFound();

  const roster = (memberRows ?? []).map((row) => ({
    id: row.user_id as string,
    nickname:
      ((row.profiles as unknown as { nickname?: string } | null)?.nickname ?? 'Member') as string,
  }));
  const memberCount = roster.length;

  const isMember = !!membership;
  const isOwner = group.owner_id === user.id;
  const requestStatus: JoinRequestStatus | null =
    (joinRequest?.status as JoinRequestStatus | undefined) ?? null;

  // Private group, non-member: the link reveals only the group's name.
  // Content stays blocked behind an access request the owner must approve.
  if (!isMember && group.visibility === 'private') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stone-900 border border-white/[0.07]">
          <Lock className="h-5 w-5 text-stone-500" />
        </span>
        <h1 className="page-title mt-5">{group.name}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-stone-500">
          This archive is private. Ask the owner for access and they will see your request the next
          time they open it.
        </p>
        <div className="mt-6 flex justify-center">
          <RequestAccessPanel groupId={groupId} requestStatus={requestStatus} />
        </div>
        <Link href="/discover" className="mt-4 inline-flex">
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
      <header className="space-y-3">
        <Link
          href={isMember ? '/dashboard' : '/discover'}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-stone-500 transition-colors hover:text-stone-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isMember ? 'My archives' : 'Discover'}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 space-y-2">
            <h1 className="page-title">{group.name}</h1>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-stone-800 px-1.5 py-0.5 text-[11.5px] font-medium text-stone-400">
                {group.visibility === 'public' ? (
                  <>
                    <Globe className="h-2.5 w-2.5" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="h-2.5 w-2.5" /> Private
                  </>
                )}
              </span>
              {!isMember ? (
                <span className="rounded-[var(--radius-sm)] bg-stone-800 px-1.5 py-0.5 text-[11.5px] font-medium text-stone-500">
                  Read only
                </span>
              ) : null}
            </div>

            {group.description ? (
              <p className="max-w-2xl text-[13.5px] leading-relaxed text-stone-500">
                {group.description}
              </p>
            ) : null}

            <MemberRoster members={roster} count={memberCount} />

            {!isMember ? (
              <div className="pt-1">
                <RequestAccessPanel groupId={groupId} requestStatus={requestStatus} />
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ShareGroupButton groupId={groupId} groupName={group.name} />
            {isMember && (
              <Link href={`/groups/${groupId}/settings`}>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Media section — streams in with skeleton */}
      <Suspense fallback={<MediaSectionLoader />}>
        <GroupMediaLoader
          groupId={groupId}
          groupName={group.name}
          userId={user.id}
          isMember={isMember}
          isOwner={isOwner}
          initialActiveType={initialActiveType as 'all' | MediaType}
          initialPage={initialPage}
          initialView={rawView === 'grid' || rawView === 'stats' ? rawView : 'list'}
        />
      </Suspense>
    </div>
  );
}

/**
 * Who is in this group. Names, not a number: an archive is the people keeping
 * it, and a count of five tells you nothing about whether you know them.
 *
 * Written as a sentence, not as chips. Chips made the members look exactly like
 * the Private badge sitting two lines above them — same pill, same size, same
 * grey — so a phone showed one undifferentiated field of little boxes. A badge
 * marks a STATE; a list of people is just text, and reads as text.
 */
function MemberRoster({
  members,
  count,
}: {
  members: { id: string; nickname: string }[];
  count: number;
}) {
  const shown = members.slice(0, 5);
  const extra = count - shown.length;

  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-stone-500">
      <Users className="h-3.5 w-3.5 shrink-0 text-stone-600" aria-hidden />
      <span className="shrink-0 font-medium text-stone-400">
        {count} {count === 1 ? 'member' : 'members'}
      </span>
      {shown.length > 0 ? (
        <>
          <span aria-hidden className="shrink-0 text-stone-700">
            ·
          </span>
          <span className="truncate">
            {shown.map((member) => member.nickname).join(', ')}
            {extra > 0 ? ` and ${extra} more` : ''}
          </span>
        </>
      ) : null}
    </p>
  );
}
