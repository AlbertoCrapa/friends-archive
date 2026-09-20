'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ItemStatus, MediaItemWithDetails } from '@/types';

interface Options {
  userId: string;
  /** Items the viewer has already consumed, from the server. */
  consumedSet: Set<string>;
  onUpdated?: (item: MediaItemWithDetails) => void;
}

/**
 * The viewer's own status on an item, written optimistically.
 *
 * Status is per-member: only the current user's row in item_statuses is
 * touched, never the shared media_items row. Marking something completed also
 * writes the consumption record (and clearing it removes that record), because
 * "I finished it" is the one status the rest of the group can see.
 *
 * The optimistic state is applied first and rolled back if the write fails, so
 * a status change feels instant on a list of sixty rows.
 */
export function useItemStatus({ userId, consumedSet, onUpdated }: Options) {
  const [consumed, setConsumed] = useState<Set<string>>(new Set(consumedSet));
  const [pending, setPending] = useState<Record<string, ItemStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const statusOf = (item: MediaItemWithDetails): ItemStatus => pending[item.id] ?? item.status;
  const isConsumed = (itemId: string) => consumed.has(itemId);

  async function setStatus(item: MediaItemWithDetails, next: ItemStatus) {
    const previous = item.status;
    const wasConsumed = consumed.has(item.id);
    const willConsume = next === 'completed';

    setPending((prev) => ({ ...prev, [item.id]: next }));
    setConsumed((prev) => {
      const draft = new Set(prev);
      if (willConsume) draft.add(item.id);
      else draft.delete(item.id);
      return draft;
    });
    setSavingId(item.id);

    const supabase = createClient();
    const { error } = await supabase
      .from('item_statuses')
      .upsert(
        { media_item_id: item.id, user_id: userId, status: next },
        { onConflict: 'media_item_id,user_id' }
      );

    if (!error) {
      if (willConsume) {
        await supabase
          .from('consumption_records')
          .upsert({ user_id: userId, media_item_id: item.id }, { onConflict: 'media_item_id,user_id' });
      } else {
        await supabase
          .from('consumption_records')
          .delete()
          .eq('user_id', userId)
          .eq('media_item_id', item.id);
      }
      onUpdated?.({ ...item, status: next });
      setPending((prev) => {
        const { [item.id]: _done, ...rest } = prev;
        return rest;
      });
      setSavingId(null);
      return;
    }

    // The write failed: put the row back the way the viewer found it.
    setPending((prev) => ({ ...prev, [item.id]: previous }));
    setConsumed((prev) => {
      const draft = new Set(prev);
      if (wasConsumed) draft.add(item.id);
      else draft.delete(item.id);
      return draft;
    });
    setSavingId(null);
  }

  return { statusOf, isConsumed, setStatus, savingId, consumed };
}
