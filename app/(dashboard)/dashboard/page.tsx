import { createClient } from '@/lib/supabase/server';
import type { Group, GroupRole, ItemStatus, MediaType } from '@/types';
import { DashboardContent } from '@/components/features/groups/DashboardContent';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all groups the user belongs to with member + item counts
  const { data: memberships } = await supabase
    .from('group_members')
    .select(`
      role,
      groups (
        id,
        name,
        description,
        visibility,
        created_at
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { referencedTable: 'groups', ascending: false });

  // Fetch item rows per group in one query (counts + type/status breakdown)
  const groupIds = (memberships ?? []).map((m) => (m.groups as unknown as Group)?.id).filter(Boolean);
  const { data: itemCountRows } = groupIds.length
    ? await supabase
        .from('media_items')
        .select('group_id, type, status')
        .in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string; type: MediaType; status: ItemStatus }> };

  const itemCountMap = new Map<string, number>();
  const typeCounts: Record<MediaType, number> = { movie: 0, tv_series: 0, book: 0, video_game: 0 };
  const statusCounts: Record<ItemStatus, number> = { plan_to_consume: 0, consuming: 0, completed: 0 };
  for (const row of itemCountRows ?? []) {
    itemCountMap.set(row.group_id, (itemCountMap.get(row.group_id) ?? 0) + 1);
    if (row.type in typeCounts) typeCounts[row.type as MediaType] += 1;
    if (row.status in statusCounts) statusCounts[row.status as ItemStatus] += 1;
  }

  // Fetch member counts per group
  const { data: memberCountRows } = groupIds.length
    ? await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string }> };

  const memberCountMap = new Map<string, number>();
  for (const row of memberCountRows ?? []) {
    memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
  }

  // Fetch the user's subscription plan + personal stats + recent additions (parallel)
  const [{ data: subscription }, { count: consumedCount }, { count: addedCount }, { data: recentRows }] =
    await Promise.all([
      supabase.from('subscriptions').select('plan, status').eq('user_id', user!.id).single(),
      supabase.from('consumption_records').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
      supabase.from('media_items').select('id', { count: 'exact', head: true }).eq('added_by', user!.id),
      groupIds.length
        ? supabase
            .from('media_items')
            .select('id, title, type, group_id, created_at')
            .in('group_id', groupIds)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({
            data: [] as Array<{ id: string; title: string; type: MediaType; group_id: string; created_at: string }>,
          }),
    ]);

  type GroupRow = Group & { role: GroupRole; itemCount: number; memberCount: number };
  const groups: GroupRow[] = (memberships ?? []).map((m) => {
    const g = m.groups as unknown as Group;
    return {
      ...g,
      role: m.role as GroupRole,
      itemCount: itemCountMap.get(g?.id) ?? 0,
      memberCount: memberCountMap.get(g?.id) ?? 0,
    };
  });

  const ownedCount = groups.filter((g) => g.role === 'owner').length;
  const maxOwned =
    subscription?.plan === 'premium' ? 10 : subscription?.plan === 'enterprise' ? Infinity : 2;
  const atLimit = ownedCount >= maxOwned;
  const plan = subscription?.plan ?? 'free';
  const totalItems = Array.from(itemCountMap.values()).reduce((sum, n) => sum + n, 0);

  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const recentItems = (recentRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type as MediaType,
    groupId: row.group_id,
    groupName: groupNames.get(row.group_id) ?? 'Unknown group',
    createdAt: row.created_at,
  }));

  return (
    <DashboardContent
      groups={groups}
      ownedCount={ownedCount}
      atLimit={atLimit}
      plan={plan}
      maxOwned={Number.isFinite(maxOwned) ? maxOwned : null}
      totalItems={totalItems}
      consumedCount={consumedCount ?? 0}
      addedCount={addedCount ?? 0}
      typeCounts={typeCounts}
      statusCounts={statusCounts}
      recentItems={recentItems}
    />
  );
}
