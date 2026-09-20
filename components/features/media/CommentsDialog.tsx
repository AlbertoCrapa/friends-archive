'use client';

// ============================================================================
// CommentsDialog — the thread on one item, as a dialog hanging off a row.
//
// The conversation itself lives in CommentThread, which the item sheet renders
// inline. This is the shortcut: a button on a row or a card that opens the same
// thread, against the same cache, without leaving the list.
// ============================================================================

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommentThread } from './CommentThread';

interface Props {
  itemId: string;
  itemTitle: string;
  /** Current user — required to post/edit/delete their own comment. */
  userId?: string;
  currentUserNickname?: string | null;
  /** Only members may write. Non-members (public groups) read only. */
  isMember?: boolean;
  /** Group owner — may delete anyone's comment (moderation). */
  isOwner?: boolean;
  /** Sizing for the trigger, which sits in rows and in grid cards alike. */
  triggerClassName?: string;
}

export function CommentsDialog({
  itemId,
  itemTitle,
  userId,
  currentUserNickname,
  isMember = false,
  isOwner = false,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-11 w-11', triggerClassName)}
          title="Comments"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{itemTitle} — Comments</DialogTitle>
        </DialogHeader>
        <CommentThread
          itemId={itemId}
          userId={userId}
          currentUserNickname={currentUserNickname}
          isMember={isMember}
          isOwner={isOwner}
          active={open}
        />
      </DialogContent>
    </Dialog>
  );
}
