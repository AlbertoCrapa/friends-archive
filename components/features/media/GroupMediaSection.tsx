'use client';

import { useMemo, useState } from 'react';
import { AddMediaDialog } from './AddMediaDialog';
import { MediaTable } from './MediaTable';
import type { MediaItemWithDetails, MediaType } from '@/types';

type MediaFilterType = 'all' | MediaType;

const PAGE_SIZE = 20;

interface Props {
  groupId: string;
  userId: string;
  currentUserNickname: string | null;
  isMember: boolean;
  initialItems: MediaItemWithDetails[];
  initialConsumedSet: Set<string>;
  initialActiveType: MediaFilterType;
  initialPage: number;
}

const mediaTypes: Array<{ value: MediaFilterType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv_series', label: 'TV Series' },
  { value: 'book', label: 'Books' },
  { value: 'video_game', label: 'Games' },
];

export function GroupMediaSection({
  groupId,
  userId,
  currentUserNickname,
  isMember,
  initialItems,
  initialConsumedSet,
  initialActiveType,
  initialPage,
}: Props) {
  const [activeType, setActiveType] = useState<MediaFilterType>(initialActiveType);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [items, setItems] = useState<MediaItemWithDetails[]>(initialItems);

  const filteredItems = useMemo(() => {
    if (activeType === 'all') return items;
    return items.filter((item) => item.type === activeType);
  }, [items, activeType]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

  function switchType(nextType: MediaFilterType) {
    setActiveType(nextType);
    setPage(1);
    syncUrl(nextType, 1);
  }

  function handleAddedItem(item: MediaItemWithDetails) {
    setItems((prev) => [item, ...prev]);
  }

  function handleDeletedItem(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleUpdatedItem(item: MediaItemWithDetails) {
    setItems((prev) => prev.map((current) => (current.id === item.id ? item : current)));
  }

  function goToPage(nextPage: number) {
    const bounded = Math.min(totalPages, Math.max(1, nextPage));
    setPage(bounded);
    syncUrl(activeType, bounded);
  }

  function syncUrl(type: MediaFilterType, nextPage: number) {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (type === 'all') {
      params.delete('type');
    } else {
      params.set('type', type);
    }

    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }

  function getCountForType(type: MediaFilterType) {
    if (type === 'all') return items.length;
    return items.filter((item) => item.type === type).length;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 bg-stone-950/95 backdrop-blur-sm border-b border-stone-900 pb-3 -mx-1 px-1 flex items-center justify-between gap-3">
        <div className="border-b border-stone-800 flex gap-0 overflow-x-auto overflow-y-hidden">
          {mediaTypes.map(({ value, label }) => {
            const isActive = activeType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => switchType(value)}
                className={`cursor-pointer min-h-11 px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px whitespace-nowrap
                  ${isActive
                    ? 'text-amber-500 border-amber-500'
                    : 'text-stone-500 border-transparent hover:text-stone-300'
                  }`}
              >
                {label} ({getCountForType(value)})
              </button>
            );
          })}
        </div>

        {isMember && (
          <AddMediaDialog
            groupId={groupId}
            userId={userId}
            activeType={activeType}
            onAdded={(item) => {
              const optimistic = {
                ...item,
                added_by_profile: currentUserNickname
                  ? { nickname: currentUserNickname }
                  : undefined,
                consumption_records: [],
              } satisfies MediaItemWithDetails;
              handleAddedItem(optimistic);
            }}
          />
        )}
      </div>

      <MediaTable
        items={pageItems}
        consumedSet={initialConsumedSet}
        activeType={activeType}
        isMember={isMember}
        userId={userId}
        currentUserNickname={currentUserNickname}
        onDeleted={handleDeletedItem}
        onUpdated={handleUpdatedItem}
      />

      {filteredItems.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-stone-800/50 pt-4">
          <p className="text-xs font-mono text-stone-600">
            Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-11 px-4 text-xs font-mono uppercase tracking-wider border border-stone-700 text-stone-300 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Prev
            </button>
            <span className="text-xs font-mono text-stone-500">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="min-h-11 px-4 text-xs font-mono uppercase tracking-wider border border-stone-700 text-stone-300 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
