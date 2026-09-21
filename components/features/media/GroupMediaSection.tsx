'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AddMediaDialog } from './AddMediaDialog';
import { ArchiveControls, type ArchiveView, type SortKey, type StatusFilter, type TypeFilter } from './ArchiveControls';
// The stats view is one of three, and the only one that needs a charting
// library. Loading it on demand keeps ~100kB of Recharts off the archive for
// everyone who came to read the list.
const ArchiveStats = dynamic(() => import('./ArchiveStats').then((m) => m.ArchiveStats), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[var(--radius-lg)] bg-stone-900 border border-white/[0.07]" />
  ),
});
import { MediaGrid } from './MediaGrid';
import { MediaTable } from './MediaTable';
import { ConfirmDeleteItemsDialog } from './ConfirmDeleteItemsDialog';
import { SelectionTray } from './SelectionTray';
import { TransferItemsDialog } from './TransferItemsDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useItemsDelete } from '@/hooks/useItemDelete';
import { useItemStatus } from '@/hooks/useItemStatus';
import { countLabel, getSearchTags } from '@/lib/utils';
import { getStatusLabel } from '@/types';
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';

const PAGE_SIZE = 20;

interface Props {
  groupId: string;
  /** Named, not just identified: the send dialog talks about it by name. */
  groupName: string;
  userId: string;
  currentUserNickname: string | null;
  isMember: boolean;
  isOwner: boolean;
  /** user_ids of the group's CURRENT members — drives the "everyone completed" star */
  memberIds: string[];
  /** Nicknames for those members, for the stats view. */
  members: { id: string; nickname: string }[];
  /** itemId -> user_ids that marked the item 'not interested'. Those members are
   *  skipped by the "everyone completed" marker. */
  notInterestedByItem: Record<string, string[]>;
  initialItems: MediaItemWithDetails[];
  initialConsumedSet: Set<string>;
  initialActiveType: TypeFilter;
  initialPage: number;
  /** Which of the three views to open in. Kept in the URL so a link carries it. */
  initialView?: ArchiveView;
}

function yearOf(item: MediaItemWithDetails): number {
  const metadata = item.metadata as { release_year?: number; publication_year?: number };
  return metadata?.release_year ?? metadata?.publication_year ?? 0;
}

function finishedCount(item: MediaItemWithDetails): number {
  return item.consumption_records?.length ?? 0;
}


export function GroupMediaSection({
  groupId,
  groupName,
  userId,
  currentUserNickname,
  isMember,
  isOwner,
  memberIds,
  members,
  notInterestedByItem,
  initialItems,
  initialConsumedSet,
  initialActiveType,
  initialPage,
  initialView = 'list',
}: Props) {
  const [view, setView] = useState<ArchiveView>(initialView);
  const [activeType, setActiveType] = useState<TypeFilter>(initialActiveType);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('recent');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [items, setItems] = useState<MediaItemWithDetails[]>(initialItems);
  /**
   * The item whose sheet is open, kept HERE rather than in the list, because
   * it belongs in the URL: `?item=<id>` is a link to one title inside a shared
   * archive, which is the thing a group actually wants to send each other.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * Gathering titles to send somewhere else.
   *
   * The selection lives HERE, above the filter pipeline, and holds ids rather
   * than rows — which is the whole trick. Searching, paging and switching kind
   * all re-decide which rows exist below this line, and none of them may
   * disturb what you are holding: you find one film under a search, one three
   * pages later, one behind the Books tab, and the tray keeps counting.
   */
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  /** What the send dialog is about — a whole selection, or one row's menu. */
  const [sending, setSending] = useState<MediaItemWithDetails[] | null>(null);
  /** The bulk delete has been asked for, and is waiting to be confirmed. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { toast } = useToast();

  /**
   * The viewer's own statuses, owned HERE rather than inside each list.
   *
   * Both views used to keep their own copy, initialised from the server's
   * answer at page load — so marking three films finished in the list and then
   * switching to covers showed them unfinished again, and a status set from the
   * tray could not have reached either. One owner, one truth, and the tray can
   * write to the same place the rows do.
   */
  const statusController = useItemStatus({
    userId,
    consumedSet: initialConsumedSet,
    onUpdated: handleUpdatedItem,
    onUpdatedMany: handleUpdatedItems,
  });

  const deleteItems = useItemsDelete({
    onDeleted: handleDeletedItem,
    onRestored: handleRestoredItems,
  });

  // Filter pipeline: type → status → tags → search → order
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeType !== 'all') result = result.filter((item) => item.type === activeType);
    if (activeStatus !== 'all') result = result.filter((item) => item.status === activeStatus);
    if (activeTags.length > 0) {
      result = result.filter((item) => {
        const itemTags = new Set(getSearchTags(item));
        return activeTags.every((tag) => itemTags.has(tag));
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Score 2 = title match (highest priority), 1 = tag match — getSearchTags
      // covers the visible chips AND the hidden ones (director, author, …), so
      // a person is findable by name even though it is never shown as a chip.
      // 0 = no match. Sort keeps title hits first; Array.sort is stable so
      // original (recency) order is preserved within each tier.
      result = result
        .map((item) => {
          const score = item.title.toLowerCase().includes(q)
            ? 2
            : getSearchTags(item).some((tag) => tag.toLowerCase().includes(q))
              ? 1
              : 0;
          return { item, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
    }

    // 'recent' is the order the archive already arrives in, and it is also what
    // keeps search relevance intact, so it does not re-sort.
    if (sort === 'title') return [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'year') return [...result].sort((a, b) => yearOf(b) - yearOf(a));
    if (sort === 'unfinished') return [...result].sort((a, b) => finishedCount(a) - finishedCount(b));
    if (sort === 'finished') return [...result].sort((a, b) => finishedCount(b) - finishedCount(a));
    return result;
  }, [items, activeType, activeStatus, activeTags, search, sort]);

  // The stats view answers questions about the shelf, not about the current
  // search, so it only honours the kind filter.
  const statsItems = useMemo(
    () => (activeType === 'all' ? items : items.filter((item) => item.type === activeType)),
    [items, activeType],
  );

  /** Open or close a sheet, and leave the address bar saying which. */
  function openItem(nextId: string | null) {
    setOpenId(nextId);
    syncUrl(activeType, currentPage, view, nextId);
  }

  /**
   * A link straight to one title.
   *
   * Opening `?item=<id>` has to do more than set a flag: the item has to be
   * ON SCREEN for the list to render its sheet, and whoever sent the link had
   * their own filters and their own page. So the filters come off, the page
   * jumps to wherever that item actually sits, and the stats view — which has
   * no rows at all — gives way to the list. Mount only: after that the URL
   * follows the sheet rather than the other way round.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('item');
    if (!requested) return;
    const index = items.findIndex((item) => item.id === requested);
    if (index === -1) {
      // The link points at something this archive no longer has (deleted, or
      // a different group) — drop the parameter rather than leaving a dead one.
      syncUrl(activeType, initialPage, initialView, null);
      return;
    }
    setActiveType('all');
    setActiveStatus('all');
    setActiveTags([]);
    setSearch('');
    const nextView: ArchiveView = initialView === 'stats' ? 'list' : initialView;
    setView(nextView);
    const nextPage = Math.floor(index / PAGE_SIZE) + 1;
    setPage(nextPage);
    setOpenId(requested);
    syncUrl('all', nextPage, nextView, requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

  // Read off the FULL archive, not the page: what you are holding survives
  // every filter, and an item that is deleted while held simply stops being
  // held, with no stale row left in the tray.
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const allShownSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  function switchType(nextType: TypeFilter) {
    setActiveType(nextType);
    setPage(1);
    syncUrl(nextType, 1);
  }

  function countForType(type: TypeFilter) {
    if (type === 'all') return items.length;
    return items.filter((item) => item.type === type).length;
  }

  function handleAddedItem(item: MediaItemWithDetails) {
    setItems((prev) => [item, ...prev]);
  }

  /** A new item arrives with the adder's own nickname and no records yet. */
  function handleAdded(item: MediaItemWithDetails) {
    handleAddedItem({
      ...item,
      added_by_profile: currentUserNickname ? { nickname: currentUserNickname } : undefined,
      consumption_records: [],
    } satisfies MediaItemWithDetails);
  }

  /**
   * Where each deleted row was, so an undo can put it back in its own place
   * rather than at the top of the archive. A delete is reversible for as long
   * as its toast is up, and a row that reappears somewhere else has not really
   * been restored.
   */
  const lastIndexOf = useRef(new Map<string, number>());

  function handleDeletedItem(itemId: string) {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      if (index === -1) return prev;
      lastIndexOf.current.set(itemId, index);
      return [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  }

  function handleRestoredItem(item: MediaItemWithDetails) {
    setItems((prev) => {
      if (prev.some((current) => current.id === item.id)) return prev;
      const index = Math.min(lastIndexOf.current.get(item.id) ?? 0, prev.length);
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
    lastIndexOf.current.delete(item.id);
  }

  function handleUpdatedItem(item: MediaItemWithDetails) {
    setItems((prev) => prev.map((current) => (current.id === item.id ? item : current)));
  }

  /** Sixty changed rows in one pass, rather than sixty passes over the list. */
  function handleUpdatedItems(updated: MediaItemWithDetails[]) {
    const byId = new Map(updated.map((item) => [item.id, item]));
    setItems((prev) => prev.map((current) => byId.get(current.id) ?? current));
  }

  /**
   * A move is a delete with a destination, so it borrows the delete's machinery
   * wholesale: the rows go now, the write is deferred behind the toast, and an
   * undo puts every one of them back in its own place rather than at the top.
   * Order matters — the indices were recorded as the rows left, so they are put
   * back in the same order they were taken.
   */
  function handleMovedItems(itemIds: string[]) {
    itemIds.forEach(handleDeletedItem);
  }

  function handleRestoredItems(moved: MediaItemWithDetails[]) {
    moved.forEach(handleRestoredItem);
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  /** Everything the current filters leave — not just the page on screen. */
  function selectAllShown() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of filteredItems) next.add(item.id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  /**
   * One status across the whole selection.
   *
   * The selection is deliberately KEPT afterwards: marking six films watched
   * and then sending the same six to another archive is one errand, not two,
   * and having to gather them twice would be the tray's whole point thrown
   * away. A delete clears it, because there is nothing left to hold.
   */
  async function setStatusForSelected(next: ItemStatus) {
    const target = selectedItems;
    if (target.length === 0) return;

    const ok = await statusController.setStatusMany(target, next);
    toast({
      tone: ok ? 'success' : 'neutral',
      message: ok ? (
        <>
          Marked <b>{countLabel(target.length)}</b> as {getStatusLabel(next).toLowerCase()}
        </>
      ) : (
        <>Could not mark those {countLabel(target.length)} — nothing changed.</>
      ),
    });
  }

  function goToPage(nextPage: number) {
    const bounded = Math.min(totalPages, Math.max(1, nextPage));
    setPage(bounded);
    syncUrl(activeType, bounded);
  }

  function switchView(next: ArchiveView) {
    // Stats has no rows, so a selection made over it could never be seen, let
    // alone corrected. Leaving the mode is the honest thing to do.
    if (next === 'stats') exitSelecting();
    setView(next);
    syncUrl(activeType, currentPage, next);
  }

  function syncUrl(
    type: TypeFilter,
    nextPage: number,
    nextView: ArchiveView = view,
    nextItem: string | null = openId,
  ) {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (type === 'all') params.delete('type');
    else params.set('type', type);
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    if (nextView === 'list') params.delete('view');
    else params.set('view', nextView);
    if (nextItem) params.set('item', nextItem);
    else params.delete('item');
    const query = params.toString();
    window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  const hasActiveFilter = Boolean(
    search.trim() || activeStatus !== 'all' || activeType !== 'all' || activeTags.length > 0,
  );

  function clearFilters() {
    setSearch('');
    setActiveStatus('all');
    setActiveType('all');
    setActiveTags([]);
    setPage(1);
    syncUrl('all', 1);
  }

  return (
    // Room at the foot for the floating add button, which only floats on a phone.
    <div className="pb-24 md:pb-10">
      {/* Touch: the same action as a disc in the thumb corner. It steps aside
          while the tray is up — one floating control per corner, and the tray
          is the one that matters while you are gathering. */}
      {isMember && !selecting ? (
        <AddMediaDialog
          variant="fab"
          groupId={groupId}
          userId={userId}
          activeType={activeType as 'all' | MediaType}
          onAdded={handleAdded}
        />
      ) : null}

      <ArchiveControls
        view={view}
        onView={switchView}
        type={activeType}
        onType={switchType}
        countForType={countForType}
        status={activeStatus}
        onStatus={(next) => {
          setActiveStatus(next);
          setPage(1);
        }}
        sort={sort}
        onSort={(next) => {
          setSort(next);
          setPage(1);
        }}
        search={search}
        onSearch={(next) => {
          setSearch(next);
          setPage(1);
        }}
        shown={filteredItems.length}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        hasActiveFilter={hasActiveFilter}
        onClear={clearFilters}
        selecting={selecting}
        onSelecting={
          isMember
            ? (next) => {
                if (next) setSelecting(true);
                else exitSelecting();
              }
            : undefined
        }
        action={
          isMember ? (
            <AddMediaDialog
              groupId={groupId}
              userId={userId}
              activeType={activeType as 'all' | MediaType}
              onAdded={handleAdded}
            />
          ) : null
        }
      />

      <div className="mt-4">
        {view === 'stats' ? (
          <ArchiveStats
            items={statsItems}
            members={members}
            memberIds={memberIds}
            notInterestedByItem={notInterestedByItem}
            userId={userId}
            consumedSet={statusController.consumed}
          />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-stone-900 p-10 text-center border border-white/[0.07]">
            <h3 className="text-[15px] font-semibold text-stone-100">Nothing matches</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
              {hasActiveFilter
                ? 'Loosen a filter and the archive comes back.'
                : 'This archive is empty. Add the first title to start it.'}
            </p>
            {hasActiveFilter ? (
              <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : view === 'grid' ? (
          <MediaGrid
            items={pageItems}
            consumedSet={initialConsumedSet}
            isMember={isMember}
            isOwner={isOwner}
            userId={userId}
            currentUserNickname={currentUserNickname}
            memberIds={memberIds}
            members={members}
            notInterestedByItem={notInterestedByItem}
            activeTags={activeTags}
            onToggleTag={toggleTag}
            onDeleted={handleDeletedItem}
            onRestored={handleRestoredItem}
            openId={openId}
            onOpenId={openItem}
            onUpdated={handleUpdatedItem}
            selecting={selecting}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onTransfer={isMember ? (item) => setSending([item]) : undefined}
            statusController={statusController}
          />
        ) : (
          <MediaTable
            items={pageItems}
            consumedSet={initialConsumedSet}
            activeType={activeType as 'all' | MediaType}
            isMember={isMember}
            isOwner={isOwner}
            userId={userId}
            currentUserNickname={currentUserNickname}
            memberIds={memberIds}
            members={members}
            notInterestedByItem={notInterestedByItem}
            activeTags={activeTags}
            onToggleTag={toggleTag}
            onDeleted={handleDeletedItem}
            onRestored={handleRestoredItem}
            openId={openId}
            onOpenId={openItem}
            onUpdated={handleUpdatedItem}
            selecting={selecting}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onTransfer={isMember ? (item) => setSending([item]) : undefined}
            statusController={statusController}
          />
        )}
      </div>

      {view !== 'stats' && filteredItems.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between border-t border-stone-800/70 pt-4">
          <p className="text-[12.5px] text-stone-500">
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
              Previous
            </Button>
            <span className="px-1 text-[12.5px] text-stone-500">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* What you are holding, and the one thing to do with it. */}
      {selecting ? (
        <SelectionTray
          items={selectedItems}
          shownCount={filteredItems.length}
          allShownSelected={allShownSelected}
          onSelectAllShown={selectAllShown}
          onClear={() => setSelectedIds(new Set())}
          onExit={exitSelecting}
          onSend={() => setSending(selectedItems)}
          onSetStatus={setStatusForSelected}
          onDelete={() => setConfirmingDelete(true)}
          busy={statusController.savingMany}
        />
      ) : null}

      {/* Asked BEFORE anything leaves the screen. The undo window still
          follows it — this is the first of two chances, not a replacement. */}
      {confirmingDelete && selectedItems.length > 0 ? (
        <ConfirmDeleteItemsDialog
          open
          onOpenChange={setConfirmingDelete}
          items={selectedItems}
          groupName={groupName}
          otherMemberCount={Math.max(0, memberIds.length - 1)}
          onConfirm={() => {
            deleteItems(selectedItems);
            exitSelecting();
          }}
        />
      ) : null}

      {/* One dialog for both ways in: a whole selection, or a single row's
          menu. It is mounted only while it has something to send, so it starts
          every send with no memory of the last one. */}
      {sending && sending.length > 0 ? (
        <TransferItemsDialog
          open
          onOpenChange={(next) => {
            if (!next) setSending(null);
          }}
          items={sending}
          groupId={groupId}
          groupName={groupName}
          userId={userId}
          onMoved={handleMovedItems}
          onRestored={handleRestoredItems}
          onDone={exitSelecting}
        />
      ) : null}
    </div>
  );
}
