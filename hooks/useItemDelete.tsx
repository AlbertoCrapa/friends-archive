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
