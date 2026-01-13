import { useState, useRef, useEffect, useCallback } from 'react';
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

// Custom hook for long press detection
function useLongPress(onLongPress: () => void, onClick: () => void, delay = 500) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    cancel();
    if (!isLongPressRef.current) {
      onClick();
    }
    isLongPressRef.current = false;
  }, [cancel, onClick]);

  return {
    onMouseDown: start,
    onMouseUp: handleClick,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: handleClick,
  };
}

// Component for tags with long-press support
interface LongPressTagProps {
  tag: string;
  tagIndex: number;
  onTagClick?: (tag: string) => void;
  onEditTag: (tagIndex: number) => void;
}

function LongPressTag({ tag, tagIndex, onTagClick, onEditTag }: LongPressTagProps) {
  const longPressHandlers = useLongPress(
    () => onEditTag(tagIndex), // Long press = edit this specific tag
    () => onTagClick?.(tag), // Click = filter by tag
    500
  );

  return (
    <Badge
      variant="tag"
      className="text-[10px] cursor-pointer select-none"
      {...longPressHandlers}
    >
      {tag}
    </Badge>
  );
}

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
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
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
    setEditingTagIndex(null);
    if (Array.isArray(value)) {
      setEditValue(value.join(', '));
    } else {
      setEditValue(String(value ?? ''));
    }
  };

  const handleStartEditTag = (tagIndex: number) => {
    if (column.type !== 'tags') return;
    const tags = (Array.isArray(value) ? value : []) as string[];
    setIsEditing(true);
    setEditingTagIndex(tagIndex);
    setEditValue(tags[tagIndex] || '');
  };

  const handleSave = () => {
    setIsEditing(false);
    
    let newValue: PropertyValue = editValue;
    
    // Convert to appropriate type
    if (column.type === 'number') {
      const num = parseFloat(editValue);
      newValue = isNaN(num) ? null : num;
    } else if (column.type === 'tags') {
      if (editingTagIndex !== null) {
        // Editing a single tag
        const currentTags = (Array.isArray(value) ? [...value] : []) as string[];
        const trimmedValue = editValue.trim();
        if (trimmedValue === '') {
          // Remove the tag if empty
          currentTags.splice(editingTagIndex, 1);
        } else {
          // Update the tag
          currentTags[editingTagIndex] = trimmedValue;
        }
        newValue = currentTags;
      } else {
        // Editing all tags (comma separated)
        newValue = editValue.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    
    setEditingTagIndex(null);
    
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
      setEditingTagIndex(null);
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
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {tags.map((tag, index) => (
          <LongPressTag
            key={`${tag}-${index}`}
            tag={tag}
            tagIndex={index}
            onTagClick={onTagClick}
            onEditTag={handleStartEditTag}
          />
        ))}
        {tags.length === 0 && (
          <span 
            className="text-stone-600 text-xs cursor-pointer" 
            onClick={handleStartEdit}
          >
            + Add tags
          </span>
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
