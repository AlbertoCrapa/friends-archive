'use client';

// ============================================================================
// useItemTransfer — sending titles from one archive to another.
//
// BOTH VERBS LAND THE SAME WAY. A title arrives in the destination as a NEW
// entry, under the name of whoever sent it, carrying nothing but that person's
// own progress. Comments, notes and ratings are speech addressed to the room
// they were said in, and they do not follow the work out of it. See
// lib/itemTransfer.ts for why that forces a move to be an insert-and-delete
// rather than an UPDATE of `group_id`.
//
// What differs is only the risk, so only the risk is treated differently:
//
//   COPY is additive. Nothing anywhere is lost if it goes through, so it runs
//        straight away, the dialog waits for it, and the toast reports it.
//
//   MOVE takes titles OUT of the archive you are standing in — the same shape
//        of loss as a delete, so it gets the same bargain as a delete: the rows
//        leave the screen at once and BOTH writes are handed to the toast,
//        which runs them only if the undo window closes untouched. Press Undo
//        and nothing ever happened.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { transferKey, type TransferMode } from '@/lib/itemTransfer';
import { countLabel } from '@/lib/utils';
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';

/** An archive an item can be sent to: one the viewer is a member of. */
export interface TransferTarget {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  itemCount: number;
}

/** What the destination already holds, for the duplicate check. */
export interface DestinationItem {
  title: string;
  type: MediaType;
  external_id: string | null;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

// ── The destinations ─────────────────────────────────────────────────────────

/**
 * Every OTHER archive this member belongs to.
 *
 * Membership is the whole permission model here: you can only send somewhere
 * you could have added the item by hand, which is exactly what the media_items
 * INSERT/UPDATE policies enforce server-side. A public archive you merely read
 * is not a destination, and does not appear.
 */
export function useTransferTargets({
  groupId,
  userId,
  enabled,
}: {
  groupId: string;
  userId: string;
  enabled: boolean;
}) {
  const [targets, setTargets] = useState<TransferTarget[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  // Loaded once per mount: a person does not join a group while a send dialog
  // is open, and re-reading on every open would cost a round trip per glance.
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setState('loading');
    const supabase = createClient();

    const { data: memberships, error } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, visibility)')
      .eq('user_id', userId);

    if (error) {
      // A failed read must not be remembered as "done": the next open tries
      // again rather than showing the same dead list for the session.
      loaded.current = false;
      setState('error');
      return;
    }

    const rows = (memberships ?? [])
      .map((row) => {
        const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
        return group as { id: string; name: string; visibility: 'public' | 'private' } | null;
      })
      .filter((group): group is { id: string; name: string; visibility: 'public' | 'private' } =>
        !!group && group.id !== groupId,
      );

    if (rows.length === 0) {
      setTargets([]);
      setState('ready');
      return;
    }

    // One pass for every destination's size — the number that tells you which
    // "Films" is the one you meant.
    const { data: countRows } = await supabase
      .from('media_items')
      .select('group_id')
      .in('group_id', rows.map((group) => group.id));

    const counts = new Map<string, number>();
    for (const row of countRows ?? []) {
      counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
    }

    setTargets(
      rows
        .map((group) => ({ ...group, itemCount: counts.get(group.id) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setState('ready');
  }, [groupId, userId]);

  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    void load();
  }, [enabled, load]);

  return { targets, state, reload: load };
}

// ── The send itself ──────────────────────────────────────────────────────────

export interface SendResult {
  ok: boolean;
  /** How many rows the write actually touched. */
  count: number;
  error?: string;
}

export function useItemTransfer({
  userId,
  onSent,
  onRestored,
}: {
  userId: string;
  /** Rows that have left this archive (a move) — take them off screen. */
  onSent?: (itemIds: string[]) => void;
  /** The move was undone, or its write failed: put them back where they were. */
  onRestored?: (items: MediaItemWithDetails[]) => void;
}) {
  const { toast } = useToast();
  /** target group id -> what it already holds. Re-read when a send changes it. */
  const probes = useRef(new Map<string, DestinationItem[]>());

  /** What the destination already holds, so the dialog can say what it will skip. */
  const probe = useCallback(async (targetGroupId: string): Promise<DestinationItem[] | null> => {
    const cached = probes.current.get(targetGroupId);
    if (cached) return cached;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('media_items')
      .select('title, type, external_id')
      .eq('group_id', targetGroupId);

    if (error) return null;
    const rows = (data ?? []) as DestinationItem[];
    probes.current.set(targetGroupId, rows);
    return rows;
  }, []);

  /**
   * COPY: new rows in the destination, added_by the sender.
   *
   * WHO GETS THE CREDIT. `added_by` is the sender, never the person who first
   * added it back home — who may well not be in the destination at all, and
   * would then appear on the row as a name nobody there can place. Whoever put
   * it in front of this group is the one who put it in front of this group.
   *
   * WHAT COMES ALONG. Only the sender's own progress, and only when they have
   * actually got somewhere with it. Both halves of it: the item_statuses row
   * AND, for 'completed', the bare consumption_records row that is what the
   * rest of the group reads as "they finished this" (see useItemStatus). The
   * note and the rating on that row are left NULL — a verdict is speech, and
   * speech stays in the room it was spoken in.
   */
  const copy = useCallback(
    async (items: MediaItemWithDetails[], targetGroupId: string): Promise<SendResult> => {
      if (items.length === 0) return { ok: true, count: 0 };
      const supabase = createClient();

      const { data, error } = await supabase
        .from('media_items')
        .insert(
          items.map((item) => ({
            group_id: targetGroupId,
            added_by: userId,
            title: item.title,
            type: item.type,
            genre: item.genre,
            metadata: item.metadata,
            external_id: item.external_id,
            external_source: item.external_source,
            external_url: item.external_url,
            image_url: item.image_url,
          })),
        )
        .select('id, title, type, external_id');

      if (error || !data) {
        return { ok: false, count: 0, error: 'Could not copy these right now. Please try again.' };
      }

      // Matched back by the same identity the duplicate check uses, rather than
      // by trusting the order RETURNING happens to hand them back in. The plan
      // guarantees no two sent items share a key, so the map is unambiguous.
      const newIdByKey = new Map(data.map((row) => [transferKey(row), row.id]));
      const landed = items
        .map((item) => ({ item, id: newIdByKey.get(transferKey(item)) }))
        .filter((entry): entry is { item: MediaItemWithDetails; id: string } => !!entry.id);

      // Best-effort, and deliberately not fatal: the copies exist, and a status
      // that did not follow is a wrong dot, not a lost title.
      const statuses = landed
        .filter((entry) => entry.item.status !== 'plan_to_consume')
        .map((entry) => ({
          media_item_id: entry.id,
          user_id: userId,
          status: entry.item.status as ItemStatus,
        }));

      if (statuses.length > 0) {
        await supabase
          .from('item_statuses')
          .upsert(statuses, { onConflict: 'media_item_id,user_id' });
      }

      // 'Completed' is the one status the rest of the group can see, and it is
      // read off consumption_records — so it takes a row there too, with no
      // note and no rating on it.
      const finished = landed
        .filter((entry) => entry.item.status === 'completed')
        .map((entry) => ({ media_item_id: entry.id, user_id: userId }));

      if (finished.length > 0) {
        await supabase
          .from('consumption_records')
          .upsert(finished, { onConflict: 'media_item_id,user_id' });
      }

      probes.current.delete(targetGroupId);
      return { ok: true, count: data.length };
    },
    [userId],
  );

  /**
   * MOVE: arrive first, leave second — both deferred behind the undo window.
   *
   * ORDER IS THE SAFETY. The copy lands before the original is touched, so the
   * worst a failed arrival can do is leave everything exactly where it was.
   * Doing it the other way round would mean a failed arrival had already
   * destroyed the only surviving copy, along with its whole history.
   *
   * Returns as soon as the rows are off screen — both writes are the toast's
   * problem from here, exactly as a delete is.
   */
  const move = useCallback(
    (items: MediaItemWithDetails[], target: TransferTarget) => {
      if (items.length === 0) return;
      const ids = items.map((item) => item.id);
      onSent?.(ids);

      toast({
        tone: 'success',
        message: (
          <>
            {items.length === 1 ? (
              <>
                Moved <b>{items[0].title}</b>
              </>
            ) : (
              <>Moved {countLabel(items.length)}</>
            )}{' '}
            to <b>{target.name}</b>
          </>
        ),
        onUndo: () => onRestored?.(items),
        commit: async () => {
          // 1. Land them over there. Nothing here has been touched yet.
          const landed = await copy(items, target.id);
          if (!landed.ok) {
            onRestored?.(items);
            toast({
              message:
                items.length === 1 ? (
                  <>
                    Could not move <b>{items[0].title}</b> — it is still here, untouched.
                  </>
                ) : (
                  <>
                    Could not move those {countLabel(items.length)} — they are still here,
                    untouched.
                  </>
                ),
            });
            return;
          }

          // 2. Only now take them out of here. This is what drops the old
          //    comments, notes and progress: they cascade off the deleted row.
          const supabase = createClient();
          const { error } = await supabase.from('media_items').delete().in('id', ids);
          if (!error) return;

          // Half-done, and said so rather than hidden: the copies are over
          // there and the originals are still here, which is a state a person
          // can fix in one press once they know about it.
          onRestored?.(items);
          toast({
            tone: 'destructive',
            message: (
              <>
                {items.length === 1 ? <b>{items[0].title}</b> : countLabel(items.length)} reached{' '}
                <b>{target.name}</b>, but could not be removed from here. Delete by hand, or they
                stay in both.
              </>
            ),
          });
        },
      });
    },
    [copy, onRestored, onSent, toast],
  );

  const send = useCallback(
    async ({
      items,
      target,
      mode,
    }: {
      items: MediaItemWithDetails[];
      target: TransferTarget;
      mode: TransferMode;
    }): Promise<SendResult> => {
      if (mode === 'move') {
        move(items, target);
        return { ok: true, count: items.length };
      }
      return copy(items, target.id);
    },
    [copy, move],
  );

  return { probe, send };
}
