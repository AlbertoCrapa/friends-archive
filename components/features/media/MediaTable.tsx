'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { getStatusLabel, getStatusOptions } from '@/types';
import { getStatusColor } from '@/lib/utils';
import type { ItemStatus, MediaItem, MediaItemWithDetails, MediaType } from '@/types';
import { cn } from '@/lib/utils';
import { ConsumedByDialog } from './ConsumedByDialog';
import { EditMediaItemDialog } from './EditMediaItemDialog';

interface Props {
  items: MediaItemWithDetails[];
  consumedSet: Set<string>;
  activeType: MediaType | 'all';
  isMember: boolean;
  userId: string;
  currentUserNickname: string | null;
  onDeleted?: (itemId: string) => void;
  onUpdated?: (item: MediaItemWithDetails) => void;
}

export function MediaTable({
  items,
  consumedSet,
  activeType,
  isMember,
  userId,
  currentUserNickname,
  onDeleted,
  onUpdated,
}: Props) {
  const [optimisticConsumed, setOptimisticConsumed] = useState<Set<string>>(
    new Set(consumedSet)
  );

  async function toggleConsumed(itemId: string) {
    const supabase = createClient();
    const previous = new Set(optimisticConsumed);
    const isConsumed = optimisticConsumed.has(itemId);

    // Optimistic update
    const next = new Set(optimisticConsumed);
    if (isConsumed) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setOptimisticConsumed(next);

    const { error } = isConsumed
      ? await supabase
        .from('consumption_records')
        .delete()
        .eq('user_id', userId)
        .eq('media_item_id', itemId)
      : await supabase
        .from('consumption_records')
        .insert({ user_id: userId, media_item_id: itemId });

    if (error) {
      // Roll back optimistic state on failure.
      setOptimisticConsumed(previous);
    }
  }

  async function deleteItem(itemId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('media_items').delete().eq('id', itemId);
    if (!error) {
      onDeleted?.(itemId);
    }
  }

  async function updateStatus(item: MediaItemWithDetails, nextStatus: ItemStatus) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('media_items')
      .update({ status: nextStatus })
      .eq('id', item.id)
      .select('id, group_id, title, type, status, genre, metadata, added_by, created_at, updated_at')
      .single();

    if (!error && data) {
      onUpdated?.({
        ...(data as MediaItemWithDetails),
        added_by_profile: item.added_by_profile,
        consumption_records: item.consumption_records,
      });
    }
  }

  if (items.length === 0) {
    const emptyLabel = activeType === 'all' ? 'items' : `${getTypeLabel(activeType).toLowerCase()}s`;

    return (
      <div className="border border-stone-800/50 py-16 text-center space-y-2">
        <p className="font-serif text-xl text-stone-600">
          No {emptyLabel} yet
        </p>
        {isMember && (
          <p className="text-stone-700 text-sm font-mono">Add the first one above.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0 border border-stone-800/50 divide-y divide-stone-800/50">
      {items.map((item) => {
        const consumed = optimisticConsumed.has(item.id);
        const statusLabel = getStatusLabel(item.status, item.type);
        const statusClasses = getStatusColor(item.status);

        return (
          <div
            key={item.id}
            className={cn(
              'flex items-start gap-4 px-4 py-3 group hover:bg-stone-900/30 transition-colors',
              consumed && 'opacity-60'
            )}
          >
            {/* Consumed checkbox */}
            {isMember && (
              <div className="pt-0.5 shrink-0">
                <Checkbox
                  checked={consumed}
                  onCheckedChange={() => toggleConsumed(item.id)}
                  aria-label={`Mark ${item.title} as consumed`}
                />
              </div>
            )}

            {/* Title + metadata */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className={cn(
                'text-stone-100 font-light leading-snug',
                consumed && 'line-through text-stone-500'
              )}>
                {item.title}
              </p>
              {item.metadata && (
                <p className="text-xs font-mono text-stone-600">
                  {getMetaSummary(item)}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-[10px]">
                  Added by {item.added_by_profile?.nickname ?? 'Unknown'}
                </Badge>
                <span className="text-[10px] font-mono text-stone-600">
                  {getConsumedLabel(item.type)}: {getConsumedUsers(item, currentUserNickname, consumed, userId).join(', ') || 'Nobody yet'}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <div className="shrink-0 w-40">
              {isMember ? (
                <Select
                  value={item.status}
                  onValueChange={(value) => updateStatus(item, value as ItemStatus)}
                >
                  <SelectTrigger className={cn('h-7 border text-xs', statusClasses)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions(item.type).map((statusOption) => (
                      <SelectItem key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  className={cn('shrink-0 border text-xs', statusClasses)}
                  variant={undefined}
                >
                  {statusLabel}
                </Badge>
              )}
            </div>

            {/* Who else consumed + actions */}
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ConsumedByDialog itemId={item.id} itemTitle={item.title} />

              {isMember && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <EditMediaItemDialog item={item} onUpdated={(updated) => onUpdated?.(updated)}>
                      <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                        <Pencil className="h-3 w-3 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    </EditMediaItemDialog>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-400 focus:text-red-300"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getMetaSummary(item: MediaItem): string {
  const m = item.metadata as Record<string, unknown>;
  if (!m) return '';
  const parts: string[] = [];
  if (m.director) parts.push(`dir. ${m.director}`);
  if (m.creator) parts.push(`cr. ${m.creator}`);
  if (m.author) parts.push(`${m.author}`);
  if (m.developer) parts.push(`${m.developer}`);
  if (m.release_year) parts.push(String(m.release_year));
  if (m.seasons) parts.push(`${m.seasons} seasons`);
  if (m.duration_minutes) parts.push(`${m.duration_minutes} min`);
  return parts.join(' · ');
}

function getTypeLabel(type: MediaType): string {
  switch (type) {
    case 'movie':
      return 'Movie';
    case 'tv_series':
      return 'TV Series';
    case 'book':
      return 'Book';
    case 'video_game':
      return 'Game';
  }
}

function getConsumedLabel(type: MediaType): string {
  if (type === 'book') return 'Read by';
  if (type === 'video_game') return 'Played by';
  return 'Watched by';
}

function getConsumedUsers(
  item: MediaItemWithDetails,
  currentUserNickname: string | null,
  consumed: boolean,
  userId: string
): string[] {
  const names = new Set(
    (item.consumption_records ?? [])
      .map((record) => {
        if (record.user_id === userId && currentUserNickname) return currentUserNickname;
        return record.profile?.nickname ?? null;
      })
      .filter((name): name is string => !!name)
  );

  if (consumed && currentUserNickname) names.add(currentUserNickname);
  if (!consumed && currentUserNickname) names.delete(currentUserNickname);

  return Array.from(names);
}
