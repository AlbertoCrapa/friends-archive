import { useState, useRef, useEffect } from 'react';
import { cn, getStatusColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Item, ColumnDefinition, ItemStatus, PropertyValue } from '@/types';

interface EditableCellProps {
  item: Item;
  column: ColumnDefinition;
  onUpdate: (id: string, updates: Partial<Item>) => void;
  onTagClick?: (tag: string) => void;
  currentUser?: string;
  onToggleUser?: (id: string, field: 'watchedBy' | 'plannedBy') => void;
}

const STATUS_OPTIONS: ItemStatus[] = [
  'Plan to Watch',
  'Watching',
  'Watched',
  'Plan to Read',
  'Reading',
  'Read',
];

export function EditableCell({
  item,
  column,
  onUpdate,
  onTagClick,
  currentUser,
  onToggleUser,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the value from item or properties
  const getValue = (): PropertyValue => {
    if (column.isProperty) {
      return item.properties[column.key] as PropertyValue;
    }
    return item[column.key as keyof Item] as PropertyValue;
  };

  const value = getValue();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (column.type === 'status' || column.type === 'users') return;
    setIsEditing(true);
    if (Array.isArray(value)) {
      setEditValue(value.join(', '));
    } else {
      setEditValue(String(value ?? ''));
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    
    let newValue: PropertyValue = editValue;
    
    // Convert to appropriate type
    if (column.type === 'number') {
      const num = parseFloat(editValue);
      newValue = isNaN(num) ? null : num;
    } else if (column.type === 'tags') {
      newValue = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    }
    
    if (column.isProperty) {
      onUpdate(item.id, {
        properties: { ...item.properties, [column.key]: newValue },
      });
    } else if (column.key === 'tags') {
      onUpdate(item.id, { tags: newValue as string[] });
    } else {
      onUpdate(item.id, { [column.key]: newValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Render based on column type
  if (column.type === 'status') {
    return (
      <Select
        value={item.status}
        onValueChange={(v) => onUpdate(item.id, { status: v as ItemStatus })}
      >
        <SelectTrigger className={cn('h-7 border-0 text-xs', getStatusColor(item.status))}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (column.type === 'users') {
    const users = value as string[] || [];
    const field = column.key as 'watchedBy' | 'plannedBy';
    const isCurrentUserIncluded = currentUser ? users.includes(currentUser) : false;
    
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {users.map((user) => (
          <Badge key={user} variant="secondary" className="text-[10px]">
            {user}
          </Badge>
        ))}
        {currentUser && onToggleUser && (
          <button
            onClick={() => onToggleUser(item.id, field)}
            className={cn(
              'w-5 h-5 flex items-center justify-center text-xs border transition-colors',
              isCurrentUserIncluded
                ? 'border-amber-600 text-amber-500 hover:bg-amber-900/30'
                : 'border-stone-700 text-stone-500 hover:border-stone-600'
            )}
          >
            {isCurrentUserIncluded ? '−' : '+'}
          </button>
        )}
      </div>
    );
  }

  if (column.type === 'tags' && !isEditing) {
    const tags = (Array.isArray(value) ? value : []) as string[];
    return (
      <div
        className="flex flex-wrap gap-1 min-h-[24px] cursor-pointer"
        onClick={handleStartEdit}
      >
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="tag"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(tag);
            }}
            className="text-[10px]"
          >
            {tag}
          </Badge>
        ))}
        {tags.length === 0 && (
          <span className="text-stone-600 text-xs">—</span>
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 text-xs border-amber-600 bg-stone-950"
      />
    );
  }

  // Default text display
  return (
    <div
      className="min-h-[24px] cursor-pointer hover:bg-stone-800/50 px-1 -mx-1 flex items-center"
      onClick={handleStartEdit}
    >
      <span className={cn('text-sm', !value && 'text-stone-600')}>
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    </div>
  );
}
