'use client';

// ============================================================================
// useItemDelete — deleting a shared title, undoably, from anywhere.
//
// The same bargain wherever it is offered (a row's menu, a swipe, the item
// sheet): the item leaves the archive on screen immediately, and the DELETE is
// handed to the toast, which runs it only if the undo window closes untouched.
// Nothing is deleted and then restored, so an undo cannot half-fail and the
// item's comments, statuses and completions are never in danger.
// ============================================================================

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { countLabel } from '@/lib/utils';
import type { MediaItemWithDetails } from '@/types';

export function useItemDelete({
  onDeleted,
  onRestored,
}: {
  onDeleted?: (itemId: string) => void;
  onRestored?: (item: MediaItemWithDetails) => void;
}) {
  const { toast } = useToast();

  return useCallback(
    (item: MediaItemWithDetails) => {
      onDeleted?.(item.id);
      toast({
        tone: 'destructive',
        message: (
          <>
            Deleted <b>{item.title}</b>
          </>
        ),
        onUndo: () => onRestored?.(item),
        commit: async () => {
          const supabase = createClient();
          const { error } = await supabase.from('media_items').delete().eq('id', item.id);
          if (!error) return;
          // The window closed, the write failed: the row is still there on the
          // server, so it goes back on screen rather than quietly disappearing
          // until the next reload.
          onRestored?.(item);
          toast({
            message: (
              <>
                Could not delete <b>{item.title}</b> — it is back in the archive.
              </>
            ),
          });
        },
      });
    },
    [onDeleted, onRestored, toast],
  );
}

/**
 * The same bargain, for a whole selection at once.
 *
 * ONE toast, not forty. A per-item toast would queue three deep and settle the
 * rest early (see the dock's MAX_QUEUE), which would quietly commit most of the
 * batch while the undo was still on screen for the first three — the exact
 * opposite of what an undo window is for. One toast means one deadline and one
 * DELETE, so the batch is all-or-nothing.
 *
 * Unlike the single-row delete, the caller is expected to have ASKED FIRST:
 * forty rows leaving at once is not something a stray tap should be able to do,
 * and a toast that says "deleted 40" is a poor place to learn what you did.
 */
export function useItemsDelete({
  onDeleted,
  onRestored,
}: {
  onDeleted?: (itemId: string) => void;
  onRestored?: (items: MediaItemWithDetails[]) => void;
}) {
  const { toast } = useToast();

  return useCallback(
    (items: MediaItemWithDetails[]) => {
      if (items.length === 0) return;
      const ids = items.map((item) => item.id);
      items.forEach((item) => onDeleted?.(item.id));

      toast({
        tone: 'destructive',
        message:
          items.length === 1 ? (
            <>
              Deleted <b>{items[0].title}</b>
            </>
          ) : (
            <>
              Deleted <b>{countLabel(items.length)}</b>
            </>
          ),
        onUndo: () => onRestored?.(items),
        commit: async () => {
          const supabase = createClient();
          const { error } = await supabase.from('media_items').delete().in('id', ids);
          if (!error) return;
          onRestored?.(items);
          toast({
            message: (
              <>
                Could not delete those {countLabel(items.length)} — they are back in the archive.
              </>
            ),
          });
        },
      });
    },
    [onDeleted, onRestored, toast],
  );
}
