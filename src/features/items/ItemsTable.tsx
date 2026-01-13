import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal, Trash2, Eye, EyeOff, BookOpen, Tv, Film, Check } from 'lucide-react';
import { cn, getStatusColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useItemsStore } from '@/stores/items-store';
import { useAuthStore } from '@/stores/auth-store';
import { useItems } from '@/hooks/useItems';
import { EditableCell } from './EditableCell';
import type { Item, SortConfig, ItemStatus } from '@/types';

const STATUS_OPTIONS: ItemStatus[] = [
  'Plan to Watch',
  'Watching',
  'Watched',
  'Plan to Read',
  'Reading',
  'Read',
];

interface ItemsTableProps {
  onTagClick: (tag: string) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Films': return <Film className="w-3 h-3" />;
    case 'TV Series': return <Tv className="w-3 h-3" />;
    case 'Books': return <BookOpen className="w-3 h-3" />;
    default: return null;
  }
};

export function ItemsTable({ onTagClick }: ItemsTableProps) {
  const { updateItem, deleteItem, toggleUserStatus } = useItems();
  const allItems = useItemsStore((state) => state.items);
  const categories = useItemsStore((state) => state.categories);
  const activeCategory = useItemsStore((state) => state.activeCategory);
  const filters = useItemsStore((state) => state.filters);
  const sort = useItemsStore((state) => state.sort);
  const setSort = useItemsStore((state) => state.setSort);
  const updateColumnVisibility = useItemsStore((state) => state.updateColumnVisibility);
  const session = useAuthStore((state) => state.session);

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Compute filtered items with useMemo to avoid infinite loops
  const items = useMemo(() => {
    let filtered = allItems;
    
    // Filter by category (unless "all" is selected)
    if (activeCategory !== 'all') {
      const categoryName = 
        activeCategory === 'films' ? 'Films' :
        activeCategory === 'tv-series' ? 'TV Series' :
        activeCategory === 'books' ? 'Books' : activeCategory;
      
      filtered = filtered.filter((item) => item.category === categoryName);
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter((item) =>
        item.title.toLowerCase().includes(search) ||
        item.tags.some((tag) => tag.toLowerCase().includes(search))
      );
    }
    
    if (filters.status) {
      filtered = filtered.filter((item) => item.status === filters.status);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((item) =>
        filters.tags!.some((tag) => item.tags.includes(tag))
      );
    }
    
    if (filters.addedBy) {
      filtered = filtered.filter((item) => item.addedBy === filters.addedBy);
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      const field = sort.field;
      let aVal: unknown = a[field as keyof Item];
      let bVal: unknown = b[field as keyof Item];
      
      if (aVal === undefined && a.properties[field] !== undefined) {
        aVal = a.properties[field];
        bVal = b.properties[field];
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
    
    return filtered;
  }, [allItems, activeCategory, filters, sort]);

  const currentCategory = useMemo(
    () => categories.find((c) => c.id === activeCategory),
    [categories, activeCategory]
  );

  const visibleColumns = useMemo(
    () => currentCategory?.columns.filter((c) => c.visible) || [],
    [currentCategory]
  );

  const handleSort = (field: string) => {
    const newSort: SortConfig = {
      field,
      direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc',
    };
    setSort(newSort);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id);
    }
  };

  const handleToggleUser = async (id: string, field: 'watchedBy' | 'plannedBy') => {
    if (session) {
      await toggleUserStatus(id, field, session.nickname);
    }
  };

  // Get the consumed by users based on category
  const getConsumedBy = (item: Item) => {
    if (item.category === 'Books') {
      return item.watchedBy; // Uses watchedBy field but displays as "Read By"
    }
    return item.watchedBy;
  };

  if (!currentCategory) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500">
        No category selected
      </div>
    );
  }

  // Mobile card view
  const renderMobileCard = (item: Item) => {
    const users = getConsumedBy(item);
    const consumedField = item.category === 'Books' ? 'watchedBy' : 'watchedBy';
    const isCurrentUserIncluded = session?.nickname ? users.includes(session.nickname) : false;
    
    return (
      <div
        key={item.id}
        className="bg-stone-900/50 border border-stone-800 p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg text-stone-100 truncate">{item.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] gap-1">
                {getCategoryIcon(item.category)}
                {item.category}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleDelete(item.id)}
                className="text-red-400 focus:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status and User dropdowns */}
        <div className="flex gap-2">
          {/* Status dropdown */}
          <Select
            value={item.status}
            onValueChange={(v) => updateItem(item.id, { status: v as ItemStatus })}
          >
            <SelectTrigger className={cn('h-8 flex-1 text-xs', getStatusColor(item.status))}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 flex-1 text-xs justify-between font-normal">
                <span className="truncate">
                  {users.length > 0 
                    ? users.join(', ') 
                    : (item.category === 'Books' ? 'Read By' : 'Watched By')
                  }
                </span>
                {isCurrentUserIncluded && <Check className="w-3 h-3 ml-1 text-amber-500 shrink-0" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs">
                {item.category === 'Books' ? 'Read By' : 'Watched By'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {session?.nickname && (
                <DropdownMenuCheckboxItem
                  checked={isCurrentUserIncluded}
                  onCheckedChange={() => handleToggleUser(item.id, consumedField)}
                >
                  {session.nickname} (me)
                </DropdownMenuCheckboxItem>
              )}
              {users.filter(u => u !== session?.nickname).map(user => (
                <DropdownMenuItem key={user} className="text-xs text-stone-400">
                  {user}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <Badge
              key={tag}
              variant="tag"
              className="text-[10px] cursor-pointer"
              onClick={() => onTagClick(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Meta info */}
      <div className="text-xs text-stone-500">
        <span>Added by {item.addedBy}</span>
      </div>
    </div>
  );
  };

  return (
    <>
      {/* Mobile view - Cards */}
      <div className="md:hidden space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <p className="font-serif text-lg mb-2">No items yet</p>
            <p className="text-xs font-mono uppercase tracking-wider">
              Add something to your archive
            </p>
          </div>
        ) : (
          items.map(renderMobileCard)
        )}
      </div>

      {/* Desktop view - Table */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-800">
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className="text-left p-3 text-xs font-mono uppercase tracking-wider text-stone-500 bg-stone-900/50"
                  style={{ width: column.width }}
                >
                  <button
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-1 hover:text-stone-300 transition-colors"
                  >
                    {column.label}
                    {sort.field === column.key && (
                      <span className="text-amber-500">
                        {sort.direction === 'asc' ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </button>
                </th>
              ))}
              <th className="w-12 p-3 bg-stone-900/50">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {currentCategory.columns.some((c) => !c.visible) ? (
                        <EyeOff className="w-3 h-3 text-amber-500" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {currentCategory.columns.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.visible}
                        onCheckedChange={(checked) =>
                          updateColumnVisibility(currentCategory.id, col.id, checked)
                        }
                      >
                        {col.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="text-center py-16 text-stone-500"
                >
                  <p className="font-serif text-lg mb-2">No items yet</p>
                  <p className="text-xs font-mono uppercase tracking-wider">
                    Add something to your archive
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-stone-800/50 transition-colors',
                    hoveredRow === item.id && 'bg-stone-800/30'
                  )}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className="p-3"
                      style={{ width: column.width }}
                    >
                      <EditableCell
                        item={item}
                        column={column}
                        onUpdate={updateItem}
                        onTagClick={onTagClick}
                        currentUser={session?.nickname}
                        onToggleUser={handleToggleUser}
                      />
                    </td>
                  ))}
                  <td className="p-3 w-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-6 w-6 opacity-0 transition-opacity',
                            hoveredRow === item.id && 'opacity-100'
                          )}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDelete(item.id)}
                          className="text-red-400 focus:text-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
