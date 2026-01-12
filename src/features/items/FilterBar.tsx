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
import { useItemsStore, selectAllTags } from '@/stores/items-store';
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
  const allTags = useItemsStore((state) => selectAllTags(state));
  const items = useItemsStore((state) => state.items);

  // Get unique users from items
  const allUsers = Array.from(
    new Set(items.flatMap((item) => [item.addedBy, ...item.watchedBy, ...item.plannedBy]))
  ).sort();

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.addedBy ||
    activeTagFilter;

  const clearAllFilters = () => {
    setFilters({});
    onClearTagFilter();
  };

  return (
    <div className="p-4 border-b border-stone-800 space-y-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search titles and tags..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
            className="h-9"
          />
        </div>

        {/* Status filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(v) =>
            setFilters({ ...filters, status: v === 'all' ? undefined : (v as ItemStatus) })
          }
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All Status" />
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
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="All Users" />
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
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Active tag filter */}
      {activeTagFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 font-mono uppercase">Showing all with tag:</span>
          <Badge variant="default" className="gap-1">
            <Hash className="w-3 h-3" />
            {activeTagFilter}
            <button
              onClick={onClearTagFilter}
              className="ml-1 hover:text-stone-950"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
          <span className="text-xs text-stone-600 font-mono">
            (Showing items from ALL categories)
          </span>
        </div>
      )}

      {/* Quick tag access */}
      {!activeTagFilter && allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-stone-500 font-mono uppercase">Tags:</span>
          {allTags.slice(0, 10).map((tag) => (
            <Badge
              key={tag}
              variant="tag"
              onClick={() => setFilters({ ...filters, tags: [tag] })}
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
