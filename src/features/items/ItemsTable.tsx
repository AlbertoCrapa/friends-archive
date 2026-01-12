import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useItemsStore, selectFilteredItems } from '@/stores/items-store';
import { useAuthStore } from '@/stores/auth-store';
import { useItems } from '@/hooks/useItems';
import { EditableCell } from './EditableCell';
import type { SortConfig } from '@/types';

interface ItemsTableProps {
  onTagClick: (tag: string) => void;
}

export function ItemsTable({ onTagClick }: ItemsTableProps) {
  const { updateItem, deleteItem, toggleUserStatus } = useItems();
  const items = useItemsStore((state) => selectFilteredItems(state));
  const categories = useItemsStore((state) => state.categories);
  const activeCategory = useItemsStore((state) => state.activeCategory);
  const sort = useItemsStore((state) => state.sort);
  const setSort = useItemsStore((state) => state.setSort);
  const updateColumnVisibility = useItemsStore((state) => state.updateColumnVisibility);
  const session = useAuthStore((state) => state.session);

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

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

  if (!currentCategory) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500">
        No category selected
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
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
  );
}
