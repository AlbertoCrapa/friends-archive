'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ItemStatus, MediaItemWithDetails } from '@/types';

interface Options {
  userId: string;
  /** Items the viewer has already consumed, from the server. */
  consumedSet: Set<string>;
  onUpdated?: (item: MediaItemWithDetails) => void;
  /**
   * One update for a whole batch, so setting sixty rows at once costs the
   * archive one pass instead of sixty. Falls back to `onUpdated` per item.
   */
  onUpdatedMany?: (items: MediaItemWithDetails[]) => void;
}

/**
 * What a list needs in order to show and change the viewer's own status.
 *
 * Exported as a type because this controller can be OWNED ABOVE the list and
 * handed down: the archive lifts it so that the list view, the covers view and
 * the selection tray are all reading and writing one set of facts. A list used
 * on its own (the stress page) still makes its own.
 */
export interface ItemStatusController {
  statusOf: (item: MediaItemWithDetails) => ItemStatus;
  isConsumed: (itemId: string) => boolean;
  setStatus: (item: MediaItemWithDetails, next: ItemStatus) => Promise<void>;
  /** The same change across many items, as ONE write and one optimistic pass. */
  setStatusMany: (items: MediaItemWithDetails[], next: ItemStatus) => Promise<boolean>;
  savingId: string | null;
  /** True while a batch is in flight. */
  savingMany: boolean;
  consumed: Set<string>;
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
export function useItemStatus({
  userId,
  consumedSet,
  onUpdated,
  onUpdatedMany,
}: Options): ItemStatusController {
  const [consumed, setConsumed] = useState<Set<string>>(new Set(consumedSet));
  const [pending, setPending] = useState<Record<string, ItemStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingMany, setSavingMany] = useState(false);

  const statusOf = (item: MediaItemWithDetails): ItemStatus => pending[item.id] ?? item.status;
  const isConsumed = (itemId: string) => consumed.has(itemId);

  function announce(items: MediaItemWithDetails[], next: ItemStatus) {
    const updated = items.map((item) => ({ ...item, status: next }));
    if (onUpdatedMany) onUpdatedMany(updated);
    else updated.forEach((item) => onUpdated?.(item));
  }

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

  /**
   * One status across a whole selection.
   *
   * Not a loop over setStatus: sixty rows would be sixty round trips and sixty
   * chances to end up half-applied. It is two writes — the statuses, then the
   * consumption records that 'completed' implies — and it rolls the whole batch
   * back together if either misses, so the selection is never left partly
   * changed with no way to tell which half took.
   *
   * Returns whether it landed; the caller owns saying so.
   */
  async function setStatusMany(items: MediaItemWithDetails[], next: ItemStatus): Promise<boolean> {
    if (items.length === 0) return true;

    const ids = items.map((item) => item.id);
    const previous = new Map(items.map((item) => [item.id, statusOf(item)]));
    const wasConsumed = new Set(ids.filter((id) => consumed.has(id)));
    const willConsume = next === 'completed';

    setPending((prev) => {
      const draft = { ...prev };
      for (const id of ids) draft[id] = next;
      return draft;
    });
    setConsumed((prev) => {
      const draft = new Set(prev);
      for (const id of ids) {
        if (willConsume) draft.add(id);
        else draft.delete(id);
      }
      return draft;
    });
    setSavingMany(true);

    const supabase = createClient();
    const { error } = await supabase.from('item_statuses').upsert(
      ids.map((id) => ({ media_item_id: id, user_id: userId, status: next })),
      { onConflict: 'media_item_id,user_id' }
    );

    let failed = !!error;

    if (!failed) {
      // The bare record, with no note and no rating on it — those are written
      // only by their owner on the item sheet, and a bulk mark is not a verdict.
      const { error: recordError } = willConsume
        ? await supabase
            .from('consumption_records')
            .upsert(
              ids.map((id) => ({ media_item_id: id, user_id: userId })),
              { onConflict: 'media_item_id,user_id' }
            )
        : await supabase
            .from('consumption_records')
            .delete()
            .eq('user_id', userId)
            .in('media_item_id', ids);
      failed = !!recordError;
    }

    if (failed) {
      setPending((prev) => {
        const draft = { ...prev };
        for (const id of ids) draft[id] = previous.get(id) ?? 'plan_to_consume';
        return draft;
      });
      setConsumed((prev) => {
        const draft = new Set(prev);
        for (const id of ids) {
          if (wasConsumed.has(id)) draft.add(id);
          else draft.delete(id);
        }
        return draft;
      });
      setSavingMany(false);
      return false;
    }

    announce(items, next);
    setPending((prev) => {
      const draft = { ...prev };
      for (const id of ids) delete draft[id];
      return draft;
    });
    setSavingMany(false);
    return true;
  }

  return { statusOf, isConsumed, setStatus, setStatusMany, savingId, savingMany, consumed };
}
