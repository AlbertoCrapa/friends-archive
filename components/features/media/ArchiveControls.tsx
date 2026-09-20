'use client';

import { BarChart3, LayoutGrid, Rows3, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { RubberSegment } from '@/components/micro/RubberSegment';
import { TYPE_ICONS } from './MediaPoster';
import { statusFilterOptions } from './StatusDot';
import type { ItemStatus, MediaType } from '@/types';

export type ArchiveView = 'list' | 'grid' | 'stats';
export type TypeFilter = 'all' | MediaType;
export type StatusFilter = 'all' | ItemStatus;
export type SortKey = 'recent' | 'title' | 'year' | 'unfinished' | 'finished';

const TYPE_LABELS: { value: TypeFilter; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies', icon: <TYPE_ICONS.movie className="h-4 w-4" /> },
  { value: 'tv_series', label: 'TV', icon: <TYPE_ICONS.tv_series className="h-4 w-4" /> },
  { value: 'book', label: 'Books', icon: <TYPE_ICONS.book className="h-4 w-4" /> },
  { value: 'video_game', label: 'Games', icon: <TYPE_ICONS.video_game className="h-4 w-4" /> },
];

const STATUS_OPTIONS = statusFilterOptions('Any status');

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title A to Z' },
  { value: 'year', label: 'Newest releases' },
  { value: 'unfinished', label: 'Fewest people done' },
  { value: 'finished', label: 'Most people done' },
];

interface Props {
  view: ArchiveView;
  onView: (view: ArchiveView) => void;
  type: TypeFilter;
  onType: (type: TypeFilter) => void;
  countForType: (type: TypeFilter) => number;
  status: StatusFilter;
  onStatus: (status: StatusFilter) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  search: string;
  onSearch: (search: string) => void;
  shown: number;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  hasActiveFilter: boolean;
  onClear: () => void;
  /** Sits at the end of the first row. The archive's one primary action. */
  action?: React.ReactNode;
}

/**
 * One bar for every way into the archive: what kind of thing, how far along it
 * is, what order to read it in, and which of the three views to read it in.
 *
 * The type filter stays a segmented control because it is the one people reach
 * for on every visit and it shows its counts without being opened. Below the
 * small breakpoint it drops to glyphs, which is the only way five filters and a
 * view switch fit across a phone without a sideways scroll. Status and order
 * are menus: used less often, and a menu costs one tap instead of a row of five.
 */
export function ArchiveControls({
  view,
  onView,
  type,
  onType,
  countForType,
  status,
  onStatus,
  sort,
  onSort,
  search,
  onSearch,
  shown,
  activeTags,
  onToggleTag,
  hasActiveFilter,
  onClear,
  action,
}: Props) {
  return (
    // No backdrop blur. At 96% opacity it bought nothing visible, and a
    // backdrop-filter turns this bar into the containing block for every fixed
    // element inside it.
    <div className="sticky top-[56px] z-20 -mx-4 border-b border-stone-800/70 bg-stone-950/96 px-4 py-2.5 sm:-mx-6 sm:px-6 sm:py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <RubberSegment
            ariaLabel="Filter by kind"
            tight="sm"
            value={type}
            onChange={(next) => onType(next as TypeFilter)}
            options={TYPE_LABELS.map((option) => ({
              ...option,
              count: countForType(option.value),
            }))}
          />
        </div>

        <div className="shrink-0">
          <RubberSegment
            ariaLabel="Change view"
            tight="lg"
            value={view}
            onChange={(next) => onView(next as ArchiveView)}
            options={[
              { value: 'list', label: 'List', icon: <Rows3 className="h-4 w-4" /> },
              { value: 'grid', label: 'Covers', icon: <LayoutGrid className="h-4 w-4" /> },
              { value: 'stats', label: 'Stats', icon: <BarChart3 className="h-4 w-4" /> },
            ]}
          />
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {view === 'stats' ? null : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <Input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search titles, people, tags"
              className="h-9 pl-9 pr-8 text-[13px]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-[var(--radius-sm)] p-1 text-stone-500 hover:text-stone-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <GlideSelect
            label="Status"
            value={status}
            onChange={(next) => onStatus(next as StatusFilter)}
            options={STATUS_OPTIONS}
          />
          <GlideSelect
            label="Order"
            value={sort}
            onChange={(next) => onSort(next as SortKey)}
            options={SORT_OPTIONS}
          />

          <span className="ml-auto shrink-0 text-[12.5px] text-stone-500">
            {shown} {shown === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}

      {activeTags.length > 0 || (hasActiveFilter && view !== 'stats') ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {activeTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              title={`Stop filtering by ${tag}`}
              className="inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] bg-amber-500/15 px-2 text-[11.5px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25"
            >
              {tag}
              <X className="h-3 w-3" />
            </button>
          ))}
          {hasActiveFilter ? (
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer text-[12.5px] font-medium text-stone-400 underline decoration-stone-700 underline-offset-4 transition-colors hover:text-stone-100"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
