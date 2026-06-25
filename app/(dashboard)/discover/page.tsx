import { createClient } from '@/lib/supabase/server';
import { DiscoverList } from '@/components/features/groups/DiscoverList';
import type { JoinRequestStatus } from '@/types';

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // All public groups — private groups are never listed here
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description, created_at, owner_id')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  const groupIds = (groups ?? []).map((g) => g.id);
  const ownerIds = [...new Set((groups ?? []).map((g) => g.owner_id))];

  // Parallel: memberships + my join requests + member counts + item counts + owner profiles
  const [
    { data: myMemberships },
    { data: myRequests },
    { data: memberRows },
    { data: itemRows },
    { data: ownerProfiles },
  ] = await Promise.all([
    user
      ? supabase.from('group_members').select('group_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] as Array<{ group_id: string }> }),
    user
      ? supabase
          .from('group_join_requests')
          .select('group_id, status')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] as Array<{ group_id: string; status: JoinRequestStatus }> }),
    groupIds.length
      ? supabase.from('group_members').select('group_id').in('group_id', groupIds)
      : Promise.resolve({ data: [] as Array<{ group_id: string }> }),
    groupIds.length
      ? supabase.from('media_items').select('group_id').in('group_id', groupIds)
      : Promise.resolve({ data: [] as Array<{ group_id: string }> }),
    ownerIds.length
      ? supabase.from('profiles').select('id, nickname').in('id', ownerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nickname: string }> }),
  ]);

  const joinedSet = new Set((myMemberships ?? []).map((m) => m.group_id));
  const requestStatusMap = new Map<string, JoinRequestStatus>(
    (myRequests ?? []).map((r) => [r.group_id, r.status as JoinRequestStatus])
  );

  const memberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
  }

  const itemCounts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    itemCounts.set(row.group_id, (itemCounts.get(row.group_id) ?? 0) + 1);
  }

  const ownerNicknames = new Map((ownerProfiles ?? []).map((p) => [p.id, p.nickname]));

  const enrichedGroups = (groups ?? []).map((g) => ({
    ...g,
    memberCount: memberCounts.get(g.id) ?? 0,
    itemCount: itemCounts.get(g.id) ?? 0,
    isMember: joinedSet.has(g.id),
    requestStatus: joinedSet.has(g.id) ? null : (requestStatusMap.get(g.id) ?? null),
    ownerNickname: ownerNicknames.get(g.owner_id) ?? null,
  }));

  return <DiscoverList groups={enrichedGroups} isAuthenticated={!!user} />;
}
