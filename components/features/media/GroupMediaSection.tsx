'use client';

import { useMemo, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { getSearchTags } from '@/lib/utils';
import type { MediaItemWithDetails, MediaType } from '@/types';

const PAGE_SIZE = 20;

interface Props {
  groupId: string;
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

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

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

  function goToPage(nextPage: number) {
    const bounded = Math.min(totalPages, Math.max(1, nextPage));
    setPage(bounded);
    syncUrl(activeType, bounded);
  }

  function switchView(next: ArchiveView) {
    setView(next);
    syncUrl(activeType, currentPage, next);
  }

  function syncUrl(type: TypeFilter, nextPage: number, nextView: ArchiveView = view) {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (type === 'all') params.delete('type');
    else params.set('type', type);
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    if (nextView === 'list') params.delete('view');
    else params.set('view', nextView);
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
      {/* Touch: the same action as a disc in the thumb corner. */}
      {isMember ? (
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
            consumedSet={initialConsumedSet}
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
            notInterestedByItem={notInterestedByItem}
            onUpdated={handleUpdatedItem}
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
            onUpdated={handleUpdatedItem}
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
    </div>
  );
}
