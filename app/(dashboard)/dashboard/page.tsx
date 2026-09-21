import { createClient } from '@/lib/supabase/server';
import { transferKey } from '@/lib/itemTransfer';
import type { Group, GroupRole, ItemStatus, MediaType } from '@/types';
import { DashboardContent } from '@/components/features/groups/DashboardContent';

/** Covers the strip shows. */
const RECENT_SHOWN = 6;
/**
 * How many rows we ask for to fill those six. The same film sitting in three
 * of your groups is three rows here, and after folding them together six rows
 * could leave two covers — so read a wider slice and trim after.
 */
const RECENT_POOL = RECENT_SHOWN * 5;

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

  // Fetch item rows per group in one query (counts + type breakdown)
  const groupIds = (memberships ?? []).map((m) => (m.groups as unknown as Group)?.id).filter(Boolean);
  // One pass over the same rows feeds three things: the per-group counts, the
  // overall type breakdown, and the handful of covers each group card wears.
  // Artwork is already on the row, so none of it costs another round trip.
  const { data: itemCountRows } = groupIds.length
    ? await supabase
        .from('media_items')
        .select('group_id, type, image_url, created_at')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ group_id: string; type: MediaType; image_url: string | null; created_at: string }> };

  const itemCountMap = new Map<string, number>();
  const typeCounts: Record<MediaType, number> = { movie: 0, tv_series: 0, book: 0, video_game: 0 };
  const typeCountsByGroup = new Map<string, Record<MediaType, number>>();
  const coversByGroup = new Map<string, string[]>();
  for (const row of itemCountRows ?? []) {
    itemCountMap.set(row.group_id, (itemCountMap.get(row.group_id) ?? 0) + 1);
    if (row.type in typeCounts) typeCounts[row.type as MediaType] += 1;

    const perGroup =
      typeCountsByGroup.get(row.group_id) ??
      ({ movie: 0, tv_series: 0, book: 0, video_game: 0 } as Record<MediaType, number>);
    if (row.type in perGroup) perGroup[row.type as MediaType] += 1;
    typeCountsByGroup.set(row.group_id, perGroup);

    if (row.image_url) {
      const covers = coversByGroup.get(row.group_id) ?? [];
      if (covers.length < 5) covers.push(row.image_url);
      coversByGroup.set(row.group_id, covers);
    }
  }

  // Status breakdown is PERSONAL: the current user's own item_statuses rows for
  // items in their groups. Items without a row count as 'plan_to_consume'.
  const { data: myStatusRows } = groupIds.length
    ? await supabase
        .from('item_statuses')
        .select('status, media_items!inner(group_id)')
        .eq('user_id', user!.id)
        .in('media_items.group_id', groupIds)
    : { data: [] as Array<{ status: ItemStatus }> };

  const statusCounts: Record<ItemStatus, number> = {
    plan_to_consume: 0,
    consuming: 0,
    completed: 0,
    not_interested: 0,
  };
  for (const row of myStatusRows ?? []) {
    const status = row.status as ItemStatus;
    if (status in statusCounts) statusCounts[status] += 1;
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
            .select('id, title, type, group_id, created_at, image_url, external_id')
            .in('group_id', groupIds)
            .order('created_at', { ascending: false })
            .limit(RECENT_POOL)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              title: string;
              type: MediaType;
              group_id: string;
              created_at: string;
              image_url: string | null;
              external_id: string | null;
            }>,
          }),
    ]);

  type GroupRow = Group & {
    role: GroupRole;
    itemCount: number;
    memberCount: number;
    typeCounts: Record<MediaType, number>;
    covers: string[];
  };
  const groups: GroupRow[] = (memberships ?? []).map((m) => {
    const g = m.groups as unknown as Group;
    return {
      ...g,
      role: m.role as GroupRole,
      itemCount: itemCountMap.get(g?.id) ?? 0,
      memberCount: memberCountMap.get(g?.id) ?? 0,
      typeCounts:
        typeCountsByGroup.get(g?.id) ??
        ({ movie: 0, tv_series: 0, book: 0, video_game: 0 } as Record<MediaType, number>),
      covers: coversByGroup.get(g?.id) ?? [],
    };
  });

  const ownedCount = groups.filter((g) => g.role === 'owner').length;
  const maxOwned =
    subscription?.plan === 'premium' ? 10 : subscription?.plan === 'enterprise' ? Infinity : 2;
  const atLimit = ownedCount >= maxOwned;
  const plan = subscription?.plan ?? 'free';
  const totalItems = Array.from(itemCountMap.values()).reduce((sum, n) => sum + n, 0);
  // No item_statuses row = 'plan_to_consume' by definition, so derive planned
  // from the total instead of expecting a stored row per item.
  statusCounts.plan_to_consume = Math.max(
    0,
    totalItems - statusCounts.consuming - statusCounts.completed - statusCounts.not_interested
  );

  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  // One work, one cover. The same film in two groups is two rows in the table
  // by design (an archive owns its copy), but here that reads as a stutter in
  // a strip that is meant to say "this is what is new". The newest wins, since
  // the rows arrive newest-first, and it carries the group it was just added
  // to — the one the strip is actually reporting. Identity is the same rule a
  // send uses (provider id, else title + type), so what counts as the same
  // film does not change from one screen to the next.
  const seenWorks = new Set<string>();
  const recentItems = (recentRows ?? [])
    .filter((row) => {
      const key = transferKey({ title: row.title, type: row.type as MediaType, external_id: row.external_id });
      if (seenWorks.has(key)) return false;
      seenWorks.add(key);
      return true;
    })
    .slice(0, RECENT_SHOWN)
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type as MediaType,
      groupId: row.group_id,
      groupName: groupNames.get(row.group_id) ?? 'Unknown group',
      createdAt: row.created_at,
      imageUrl: row.image_url,
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
