import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { DiscoverList } from '@/components/features/groups/DiscoverList';

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // All public groups
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description, created_at, owner_id')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  const groupIds = (groups ?? []).map((g) => g.id);
  const ownerIds = [...new Set((groups ?? []).map((g) => g.owner_id))];

  // Parallel: memberships + member counts + item counts + owner profiles
  const [
    { data: myMemberships },
    { data: memberRows },
    { data: itemRows },
    { data: ownerProfiles },
  ] = await Promise.all([
    user
      ? supabase.from('group_members').select('group_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] as Array<{ group_id: string }> }),
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

  const memberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
  }

  const itemCounts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    itemCounts.set(row.group_id, (itemCounts.get(row.group_id) ?? 0) + 1);
  }

  const ownerNicknames = new Map((ownerProfiles ?? []).map((p) => [p.id, p.nickname]));

  async function joinGroup(groupId: string) {
    'use server';
    if (!user) return;
    const supabase2 = await createClient();
    await supabase2.from('group_members').upsert(
      { group_id: groupId, user_id: user.id, role: 'member' },
      { onConflict: 'group_id,user_id' }
    );
    revalidatePath('/discover');
    revalidatePath(`/groups/${groupId}`);
  }

  const enrichedGroups = (groups ?? []).map((g) => ({
    ...g,
    memberCount: memberCounts.get(g.id) ?? 0,
    itemCount: itemCounts.get(g.id) ?? 0,
    isMember: joinedSet.has(g.id),
    ownerNickname: ownerNicknames.get(g.owner_id) ?? null,
  }));

  return (
    <DiscoverList
      groups={enrichedGroups}
      isAuthenticated={!!user}
      joinGroup={joinGroup}
    />
  );
}
