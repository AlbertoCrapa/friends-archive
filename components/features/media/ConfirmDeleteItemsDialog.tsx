'use client';

// ============================================================================
// ConfirmDeleteItemsDialog — the one question a bulk delete has to ask.
//
// A single row is deleted with no confirmation anywhere in this app, and that
// is right: one row, one toast, one press to undo. A SELECTION is a different
// animal. Forty rows can be gathered in a few seconds across four filters, and
// by the time the toast says "deleted 40" it is far too late to learn what the
// forty were — so the covers go up first, with the three consequences people
// do not think of, and the destructive button spells out the count.
//
// It does NOT replace the undo. It comes before it. Ask, then still give them
// the window back.
// ============================================================================

import { AlertTriangle, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogSheetBody,
  DialogSheetContent,
  DialogSheetFooter,
  DialogSheetHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { countLabel } from '@/lib/utils';
import type { MediaItemWithDetails } from '@/types';
import { ItemPreviewStrip } from './ItemPreviewStrip';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaItemWithDetails[];
  /** The archive they are being taken out of, named. */
  groupName: string;
  /** How many OTHER members will be told. Omitted when it is not known. */
  otherMemberCount?: number;
  onConfirm: () => void;
}

export function ConfirmDeleteItemsDialog({
  open,
  onOpenChange,
  items,
  groupName,
  otherMemberCount,
  onConfirm,
}: Props) {
  const many = items.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogSheetContent open={open} onDismiss={() => onOpenChange(false)}>
        <DialogSheetHeader>
          <DialogTitle>
            {many ? `Delete ${countLabel(items.length)}?` : 'Delete this item?'}
          </DialogTitle>
          <p className="mt-1 truncate text-[12.5px] text-stone-500">from {groupName}</p>
        </DialogSheetHeader>

        <DialogSheetBody className="space-y-4">
          <ItemPreviewStrip items={items} />

          <ul className="space-y-2.5 rounded-[var(--radius-md)] border border-red-500/25 bg-red-500/[0.06] p-3.5">
            <Consequence icon={<Users className="h-3.5 w-3.5" />}>
              {many ? 'They leave' : 'It leaves'} <b className="font-medium text-stone-200">{groupName}</b>{' '}
              for <b className="font-medium text-stone-200">everyone</b> — this is not a personal
              filter, and no other member can put {many ? 'them' : 'it'} back.
            </Consequence>
            <Consequence icon={<Trash2 className="h-3.5 w-3.5" />}>
              Every comment, note and rating anyone ever wrote on {many ? 'them' : 'it'} goes too,
              and cannot be recovered.
            </Consequence>
            {otherMemberCount && otherMemberCount > 0 ? (
              <Consequence icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                The other {otherMemberCount === 1 ? 'member' : `${otherMemberCount} members`} will be
                told you did it.
              </Consequence>
            ) : null}
          </ul>

          {/* Said out loud so the confirm does not read as the point of no
              return — it is the second-to-last one. */}
          <p className="text-[12.5px] leading-relaxed text-stone-500">
            Nothing is written until the undo window on the next notification closes. Press
            <b className="font-medium text-stone-400"> Undo</b> there and none of this happens.
          </p>
        </DialogSheetBody>

        <DialogSheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete {many ? countLabel(items.length) : 'it'}
          </Button>
        </DialogSheetFooter>
      </DialogSheetContent>
    </Dialog>
  );
}

function Consequence({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[12.5px] leading-relaxed text-stone-400">
      <span className="mt-0.5 shrink-0 text-red-400" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
