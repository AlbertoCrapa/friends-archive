import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupMediaSection } from '@/components/features/media/GroupMediaSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Lock, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import type { ConsumptionRecord, GroupRole, MediaItemWithDetails, MediaType } from '@/types';

interface Props {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ type?: 'all' | MediaType; page?: string }>;
}

export default async function GroupDetailPage({ params, searchParams }: Props) {
  const { groupId } = await params;
  const { type: rawType, page: rawPage } = await searchParams;
  const activeType = rawType ?? 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch the group
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, description, visibility, owner_id, created_at')
    .eq('id', groupId)
    .single();

  if (!group) notFound();

  // Determine membership
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  const isMember = !!membership;
  const role: GroupRole | null = membership?.role ?? null;
  const isOwner = role === 'owner';

  // Non-members can only view public groups in read-only mode
  if (!isMember && group.visibility === 'private') notFound();

  // Fetch all media items once; client-side tabs filter without refetching.
  const { data: items } = await supabase
    .from('media_items')
    .select('id, group_id, title, type, status, genre, metadata, added_by, created_at, updated_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  const itemIds = (items ?? []).map((item) => item.id);
  const adderIds = Array.from(new Set((items ?? []).map((item) => item.added_by)));

  const [{ data: adders }, { data: consumptionRows }, { data: currentProfile }] = await Promise.all([
    adderIds.length > 0
      ? supabase.from('profiles').select('id, nickname').in('id', adderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nickname: string }> }),
    itemIds.length > 0
      ? supabase
          .from('consumption_records')
          .select('id, media_item_id, user_id, consumed_at, note, created_at, updated_at, profiles(nickname)')
          .in('media_item_id', itemIds)
      : Promise.resolve({ data: [] as Array<{
          id: string;
          media_item_id: string;
          user_id: string;
          consumed_at: string;
          note: string | null;
          created_at: string;
          updated_at: string;
          profiles: { nickname: string } | null;
        }> }),
    supabase.from('profiles').select('nickname').eq('id', user.id).single(),
  ]);

  const consumedSet = new Set(
    (consumptionRows ?? [])
      .filter((row) => row.user_id === user.id)
      .map((row) => row.media_item_id)
  );

  const addersById = new Map((adders ?? []).map((adder) => [adder.id, adder.nickname]));
  const consumptionByItemId = new Map<string, ConsumptionRecord[]>();

  for (const row of consumptionRows ?? []) {
    const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    const nextRow: ConsumptionRecord = {
      id: row.id,
      media_item_id: row.media_item_id,
      user_id: row.user_id,
      consumed_at: row.consumed_at,
      note: row.note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: profileRow ? { nickname: profileRow.nickname } : undefined,
    };

    const list = consumptionByItemId.get(row.media_item_id) ?? [];
    list.push(nextRow);
    consumptionByItemId.set(row.media_item_id, list);
  }

  const enrichedItems: MediaItemWithDetails[] = (items ?? []).map((item) => ({
    ...item,
    added_by_profile: addersById.get(item.added_by)
      ? { nickname: addersById.get(item.added_by)! }
      : undefined,
    consumption_records: consumptionByItemId.get(item.id) ?? [],
  }));
  // Member count
  const { count: memberCount } = await supabase
    .from('group_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  const validTypes = new Set(['all', 'movie', 'tv_series', 'book', 'video_game']);
  const initialActiveType = validTypes.has(activeType) ? activeType : 'all';
  const parsedPage = Number(rawPage);
  const initialPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return (
    <div className="space-y-8">
      {/* Group header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
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

      <GroupMediaSection
        groupId={groupId}
        userId={user.id}
        currentUserNickname={currentProfile?.nickname ?? null}
        isMember={isMember}
        initialItems={enrichedItems}
        initialConsumedSet={consumedSet}
        initialActiveType={initialActiveType as 'all' | MediaType}
        initialPage={initialPage}
      />
    </div>
  );
}
