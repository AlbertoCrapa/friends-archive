import { createClient, getUser } from '@/lib/supabase/server';
import { transferKey } from '@/lib/itemTransfer';
import type { Group, GroupRole, ItemStatus, MediaType } from '@/types';
import { DashboardContent } from '@/components/features/groups/DashboardContent';
import { OfflineBadge } from '@/components/features/groups/OfflineApp';

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
  const user = (await getUser())!;

  // TWO ROUNDS, not five in a row. Round one: everything that only needs the
  // user, memberships included. Round two: everything that needs the group ids
  // round one found. Each round costs its slowest query, not their sum.
  const [
    { data: memberships },
    { data: subscription },
    { count: consumedCount },
    { count: addedCount },
    { data: pendingRows },
  ] = await Promise.all([
    supabase
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
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'groups', ascending: false }),
    supabase.from('subscriptions').select('plan, status').eq('user_id', user.id).single(),
    supabase.from('consumption_records').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('media_items').select('id', { count: 'exact', head: true }).eq('added_by', user.id),
    // Groups you have asked to join and are still waiting on. Group METADATA
    // is readable by any signed-in user — that is what makes a private link
    // resolve to a page with a name and a request button — so this join
    // reaches the name and visibility of a group you are not in yet. Its
    // CONTENTS stay shut, which is why these rows carry no counts and no
    // covers: there is nothing honest to put there until you are let in.
    supabase
      .from('group_join_requests')
      .select('id, created_at, groups ( id, name, description, visibility )')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  const groupIds = (memberships ?? []).map((m) => (m.groups as unknown as Group)?.id).filter(Boolean);
  const none = { data: [] as never[] };
  const [
    { data: itemCountRows },
    { data: myStatusRows },
    { data: memberCountRows },
    { data: recentRows },
  ] = groupIds.length
    ? await Promise.all([
        // One pass over the same rows feeds three things: the per-group counts,
        // the overall type breakdown, and the handful of covers each group card
        // wears. Artwork is already on the row, so none of it costs another trip.
        supabase
          .from('media_items')
          .select('group_id, type, image_url, created_at')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false }),
        // Status breakdown is PERSONAL: the current user's own item_statuses
        // rows for items in their groups. No row counts as 'plan_to_consume'.
        supabase
          .from('item_statuses')
          .select('status, media_items!inner(group_id)')
          .eq('user_id', user.id)
          .in('media_items.group_id', groupIds),
        supabase.from('group_members').select('group_id').in('group_id', groupIds),
        supabase
          .from('media_items')
          .select('id, title, type, group_id, created_at, image_url, external_id')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })
          .limit(RECENT_POOL),
      ])
    : [none, none, none, none];

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

  const memberCountMap = new Map<string, number>();
  for (const row of memberCountRows ?? []) {
    memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
  }

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

  const pendingGroups = (pendingRows ?? [])
    .map((row) => {
      const g = row.groups as unknown as Group | null;
      return g
        ? {
            id: g.id,
            name: g.name,
            description: g.description,
            visibility: g.visibility,
            requestedAt: row.created_at,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <>
      {/* Offline here too: the installed app opens on this page. */}
      <OfflineBadge />
      <DashboardContent
        groups={groups}
        pendingGroups={pendingGroups}
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
    </>
  );
}
