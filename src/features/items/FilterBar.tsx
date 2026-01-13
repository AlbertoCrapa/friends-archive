import { useMemo } from 'react';
import { X, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useItemsStore } from '@/stores/items-store';
import type { ItemStatus } from '@/types';

const STATUS_OPTIONS: ItemStatus[] = [
  'Plan to Watch',
  'Watching',
  'Watched',
  'Plan to Read',
  'Reading',
  'Read',
];

interface FilterBarProps {
  activeTagFilter: string | null;
  onClearTagFilter: () => void;
}

export function FilterBar({ activeTagFilter, onClearTagFilter }: FilterBarProps) {
  const filters = useItemsStore((state) => state.filters);
  const setFilters = useItemsStore((state) => state.setFilters);
  const items = useItemsStore((state) => state.items);

  // Compute derived values with useMemo to avoid infinite loops
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((item) => {
      item.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [items]);

  // Get unique users from items
  const allUsers = useMemo(() => 
    Array.from(
      new Set(items.flatMap((item) => [item.addedBy, ...item.watchedBy, ...item.plannedBy]))
    ).sort(),
    [items]
  );

  // Check if there's an active tag from filters (top bar) or activeTagFilter (from table click)
  const currentTagFilter = activeTagFilter || (filters.tags && filters.tags.length > 0 ? filters.tags[0] : null);

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.addedBy ||
    currentTagFilter;

  const clearAllFilters = () => {
    setFilters({});
    onClearTagFilter();
  };

  const handleTagClick = (tag: string) => {
    setFilters({ ...filters, tags: [tag] });
  };

  const handleClearTag = () => {
    setFilters({ ...filters, tags: undefined });
    onClearTagFilter();
  };

  return (
    <div className="p-3 md:p-4 border-b border-stone-800 space-y-3">
      {/* Mobile: Stacked layout */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        {/* Search - full width on mobile */}
        <div className="flex-1 md:max-w-sm">
          <Input
            placeholder="Search..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
            className="h-9"
          />
        </div>

        {/* Filters row on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Status filter */}
          <Select
            value={filters.status || 'all'}
            onValueChange={(v) =>
              setFilters({ ...filters, status: v === 'all' ? undefined : (v as ItemStatus) })
            }
          >
            <SelectTrigger className="w-28 md:w-40 h-9 shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User filter */}
          <Select
            value={filters.addedBy || 'all'}
            onValueChange={(v) =>
              setFilters({ ...filters, addedBy: v === 'all' ? undefined : v })
            }
          >
            <SelectTrigger className="w-24 md:w-32 h-9 shrink-0">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {allUsers.map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="shrink-0">
              <X className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active tag filter - shown for both sources */}
      {currentTagFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] md:text-xs text-stone-500 font-mono uppercase">Showing tag:</span>
          <Badge variant="default" className="gap-1">
            <Hash className="w-3 h-3" />
            {currentTagFilter}
            <button
              onClick={handleClearTag}
              className="ml-1 hover:text-stone-950"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
          <span className="text-[10px] md:text-xs text-stone-600 font-mono">
            (All categories)
          </span>
        </div>
      )}

      {/* Quick tag access - hidden on mobile when filter is active */}
      {!currentTagFilter && allTags.length > 0 && (
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <span className="text-xs text-stone-500 font-mono uppercase">Tags:</span>
          {allTags.slice(0, 10).map((tag) => (
            <Badge
              key={tag}
              variant="tag"
              onClick={() => handleTagClick(tag)}
              className="cursor-pointer text-[10px]"
            >
              {tag}
            </Badge>
          ))}
          {allTags.length > 10 && (
            <span className="text-xs text-stone-600">+{allTags.length - 10} more</span>
          )}
        </div>
      )}
    </div>
  );
}
