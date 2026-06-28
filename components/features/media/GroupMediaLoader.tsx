import { createClient } from '@/lib/supabase/server';
import { GroupMediaSection } from './GroupMediaSection';
import type { ConsumptionRecord, MediaItemWithDetails, MediaType } from '@/types';

interface Props {
  groupId: string;
  userId: string;
  isMember: boolean;
  isOwner: boolean;
  initialActiveType: 'all' | MediaType;
  initialPage: number;
}

export async function GroupMediaLoader({
  groupId,
  userId,
  isMember,
  isOwner,
  initialActiveType,
  initialPage,
}: Props) {
  const supabase = await createClient();

  const [
    { data: currentProfile },
    { data: items },
  ] = await Promise.all([
    supabase.from('profiles').select('nickname').eq('id', userId).single(),
    supabase
      .from('media_items')
      .select('id, group_id, title, type, status, genre, metadata, added_by, external_id, external_source, external_url, created_at, updated_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ]);

  const itemIds = (items ?? []).map((item) => item.id);
  const adderIds = Array.from(new Set((items ?? []).map((item) => item.added_by)));

  const [{ data: adders }, { data: consumptionRows }] = await Promise.all([
    adderIds.length > 0
      ? supabase.from('profiles').select('id, nickname').in('id', adderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nickname: string }> }),
    itemIds.length > 0
      ? supabase
          .from('consumption_records')
          .select('id, media_item_id, user_id, consumed_at, note, created_at, updated_at, profiles(nickname)')
          .in('media_item_id', itemIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            media_item_id: string;
            user_id: string;
            consumed_at: string;
            note: string | null;
            created_at: string;
            updated_at: string;
            profiles: { nickname: string } | null;
          }>,
        }),
  ]);

  const consumedSet = new Set(
    (consumptionRows ?? [])
      .filter((row) => row.user_id === userId)
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

  return (
    <GroupMediaSection
      groupId={groupId}
      userId={userId}
      currentUserNickname={currentProfile?.nickname ?? null}
      isMember={isMember}
      isOwner={isOwner}
      initialItems={enrichedItems}
      initialConsumedSet={consumedSet}
      initialActiveType={initialActiveType}
      initialPage={initialPage}
    />
  );
}
