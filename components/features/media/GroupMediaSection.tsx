'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AddMediaDialog } from './AddMediaDialog';
import { MediaTable } from './MediaTable';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import type { MediaItemWithDetails, MediaType } from '@/types';

type MediaFilterType = 'all' | MediaType;
type StatusFilter = 'all' | 'plan_to_consume' | 'consuming' | 'completed';

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

const typeFilters: Array<{ value: MediaFilterType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv_series', label: 'TV' },
  { value: 'book', label: 'Books' },
  { value: 'video_game', label: 'Games' },
];

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'plan_to_consume', label: 'Planned' },
  { value: 'consuming', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_ACTIVE_CLASSES: Record<StatusFilter, string> = {
  all: 'border-stone-600/70 text-stone-300 bg-stone-800/40',
  plan_to_consume: 'border-amber-700/60 text-amber-400 bg-amber-950/25',
  consuming: 'border-sky-700/60 text-sky-400 bg-sky-950/25',
  completed: 'border-emerald-700/60 text-emerald-400 bg-emerald-950/25',
};

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
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [items, setItems] = useState<MediaItemWithDetails[]>(initialItems);

  // Filter pipeline: type → status → search
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeType !== 'all') result = result.filter((item) => item.type === activeType);
    if (activeStatus !== 'all') result = result.filter((item) => item.status === activeStatus);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((item) => {
        if (item.title.toLowerCase().includes(q)) return true;
        const meta = item.metadata as Record<string, unknown> | null;
        if (!meta) return false;
        return ['director', 'creator', 'author', 'developer', 'publisher', 'platform'].some(
          (key) => typeof meta[key] === 'string' && (meta[key] as string).toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [items, activeType, activeStatus, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

  function switchType(nextType: MediaFilterType) {
    setActiveType(nextType);
    setPage(1);
    syncUrl(nextType, 1);
  }

  function getCountForType(type: MediaFilterType) {
    if (type === 'all') return items.length;
    return items.filter((item) => item.type === type).length;
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
    if (type === 'all') params.delete('type');
    else params.set('type', type);
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const query = params.toString();
    window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  const hasActiveFilter = search.trim() || activeStatus !== 'all' || activeType !== 'all';

  return (
    <div className="space-y-0">
      {/* ── Sticky control bar ────────────────────────────────────────── */}
      <div className="sticky top-[56px] z-20 bg-stone-950/96 backdrop-blur-sm border-b border-stone-900 -mx-6 px-6 pb-0">

        {/* Type filter tabs */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide" style={{ marginBottom: '-1px' }}>
            {typeFilters.map(({ value, label }) => {
              const isActive = activeType === value;
              const count = getCountForType(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchType(value)}
                  className={`cursor-pointer min-h-[44px] px-3 sm:px-4 py-2 text-xs sm:text-sm font-mono uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap
                    ${isActive
                      ? 'text-amber-500 border-amber-500'
                      : 'text-stone-500 border-transparent hover:text-stone-300'
                    }`}
                >
                  {label}
                  <span className={`ml-1.5 text-[10px] ${isActive ? 'opacity-70' : 'opacity-40'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {isMember && (
            <div className="shrink-0 pb-1">
              <AddMediaDialog
                groupId={groupId}
                userId={userId}
                activeType={activeType}
                onAdded={(item) => {
                  const optimistic = {
                    ...item,
                    added_by_profile: currentUserNickname ? { nickname: currentUserNickname } : undefined,
                    consumption_records: [],
                  } satisfies MediaItemWithDetails;
                  handleAddedItem(optimistic);
                }}
              />
            </div>
          )}
        </div>

        {/* Search + status filter row — stacks on mobile */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 py-2.5">
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: 'oklch(0.42 0.005 60)' }}
            />
            <Input
              type="search"
              placeholder="Search titles..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-9 pl-9 pr-9 text-sm font-light w-full"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: 'oklch(0.42 0.005 60)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filter — scrollable row */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide w-full sm:w-auto pb-0.5 sm:pb-0">
            {statusFilters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setActiveStatus(value); setPage(1); }}
                className={`cursor-pointer min-h-9 px-3 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap border transition-colors
                  ${activeStatus === value
                    ? STATUS_ACTIVE_CLASSES[value]
                    : 'border-stone-800/60 text-stone-500 hover:text-stone-300 hover:border-stone-700'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results count when filtering ─────────────────────────────── */}
      <AnimatePresence>
        {hasActiveFilter && (
          <motion.div
            className="flex items-center justify-between px-0 py-3 mt-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="font-mono text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>
              {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
              {search && <span> matching <em className="not-italic text-stone-300">"{search}"</em></span>}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setSearch(''); setActiveStatus('all'); setActiveType('all'); setPage(1); }}
                className="font-mono text-xs cursor-pointer transition-colors"
                style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
              >
                Clear filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Media table ───────────────────────────────────────────────── */}
      <div className="mt-4">
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
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {filteredItems.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-stone-800/50 pt-5 mt-2">
          <p className="text-xs font-mono" style={{ color: 'oklch(0.38 0.005 60)' }}>
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cursor-pointer min-h-[44px] px-4 text-xs font-mono uppercase tracking-wider border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Prev
            </button>
            <span className="text-xs font-mono px-2" style={{ color: 'oklch(0.4 0.005 60)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="cursor-pointer min-h-[44px] px-4 text-xs font-mono uppercase tracking-wider border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
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
