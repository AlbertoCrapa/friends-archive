import { createClient } from '@/lib/supabase/server';
import type { Group, GroupRole } from '@/types';
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

  // Fetch item counts per group in one query
  const groupIds = (memberships ?? []).map((m) => (m.groups as unknown as Group)?.id).filter(Boolean);
  const { data: itemCountRows } = groupIds.length
    ? await supabase
        .from('media_items')
        .select('group_id')
        .in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string }> };

  const itemCountMap = new Map<string, number>();
  for (const row of itemCountRows ?? []) {
    itemCountMap.set(row.group_id, (itemCountMap.get(row.group_id) ?? 0) + 1);
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

  // Fetch the user's subscription plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user!.id)
    .single();

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

  return (
    <DashboardContent
      groups={groups}
      ownedCount={ownedCount}
      atLimit={atLimit}
      plan={plan}
    />
  );
}
