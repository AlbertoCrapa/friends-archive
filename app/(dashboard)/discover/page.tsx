import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { DiscoverGrid } from '@/components/features/groups/DiscoverGrid';

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // All public groups
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description, created_at, owner_id')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  // User's memberships
  const { data: myMemberships } = user
    ? await supabase.from('group_members').select('group_id').eq('user_id', user.id)
    : { data: [] };

  const joinedSet = new Set((myMemberships ?? []).map((m) => m.group_id));
  const groupIds = (groups ?? []).map((g) => g.id);

  // Member counts
  const { data: memberRows } = groupIds.length
    ? await supabase.from('group_members').select('group_id').in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string }> };

  const memberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
  }

  // Item counts
  const { data: itemRows } = groupIds.length
    ? await supabase.from('media_items').select('group_id').in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string }> };

  const itemCounts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    itemCounts.set(row.group_id, (itemCounts.get(row.group_id) ?? 0) + 1);
  }

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
  }));

  return (
    <DiscoverGrid
      groups={enrichedGroups}
      isAuthenticated={!!user}
      joinGroup={joinGroup}
    />
  );
}
