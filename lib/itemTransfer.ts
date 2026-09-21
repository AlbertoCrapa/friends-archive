// ============================================================================
// Sending items between archives — pure logic.
//
// Two verbs, one arrival. Under BOTH of them the title lands in the destination
// as a brand-new media_items row, `added_by` = whoever sent it, carrying only
// that person's own progress:
//
//   COPY  insert into the destination. The origin keeps its row untouched, so
//         nobody there loses a comment or a completion.
//
//   MOVE  insert into the destination, THEN delete the origin row. The delete
//         is what drops the old conversation — comments, notes, ratings and
//         everyone's progress cascade off the row that is going away.
//
// WHY A MOVE IS NOT AN UPDATE OF `group_id`. That would be one write instead of
// two, and would keep the item's id and its deep links. It cannot be used,
// because `added_by` has to become the sender: the person who first added the
// title may not be in the destination at all, and would appear there as a name
// nobody can place. RLS pins `added_by` on UPDATE by design (DATA_MODEL § 6.5),
// so an UPDATE-based move could never reassign it. The same single write would
// also drag the origin's comments into a room they were never addressed to.
// See DATA_MODEL § 6.13.
//
// Neither verb needs a new table, a new policy or a migration: the media_items
// INSERT policy already accepts a row whose group the sender belongs to with
// `added_by = auth.uid()`, and any member of a group may delete an item in it.
// ============================================================================

import { itemKey } from './groupArchive';
import type { MediaType } from '@/types';

export type TransferMode = 'copy' | 'move';

/** The minimum an item has to say about itself to be sent, or matched. */
export interface TransferableItem {
  id: string;
  title: string;
  type: MediaType;
  external_id: string | null;
}

/**
 * Identity of a work ACROSS archives.
 *
 * A provider id is the same string in every group for the same work (see
 * DATA_MODEL § 3.5), so two archives holding "Dune" from TMDB agree without
 * having to agree on spelling. Manual entries have no such id and fall back to
 * the import rule — same title, same type — which is the same comparison the
 * archive import already makes, so a title cannot be a duplicate here and a
 * fresh item there.
 */
export function transferKey(item: Pick<TransferableItem, 'title' | 'type' | 'external_id'>): string {
  return item.external_id ? `ext::${item.external_id}` : itemKey(item.title, item.type);
}

export interface TransferPlan<T extends TransferableItem> {
  /** What will actually be written. */
  sending: T[];
  /** Already in the destination — skipped, and named so the sender knows why. */
  duplicates: T[];
}

/**
 * What a send would do, worked out BEFORE anything is written.
 *
 * Duplicates are never sent, under either verb. Copying one would put the same
 * film twice in the destination; moving one would do that AND empty the origin,
 * which is the one outcome a move must not have — so a duplicate simply stays
 * where it is and the dialog says so.
 */
export function planTransfer<T extends TransferableItem>(
  items: T[],
  destinationItems: Pick<TransferableItem, 'title' | 'type' | 'external_id'>[],
): TransferPlan<T> {
  const present = new Set(destinationItems.map(transferKey));
  const sending: T[] = [];
  const duplicates: T[] = [];
  // A selection can hold two rows of the same work (one linked, one typed by
  // hand). The first wins; the second is a duplicate of the send itself.
  const claimed = new Set<string>();

  for (const item of items) {
    const key = transferKey(item);
    if (present.has(key) || claimed.has(key)) {
      duplicates.push(item);
      continue;
    }
    claimed.add(key);
    sending.push(item);
  }

  return { sending, duplicates };
}
