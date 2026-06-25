'use client';

import { Fragment, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
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
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, ItemStatus>>({});
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MediaItemWithDetails | null>(null);

  async function deleteItem(itemId: string) {
    setDeletingItemId(itemId);
    const supabase = createClient();
    const { error } = await supabase.from('media_items').delete().eq('id', itemId);
    if (!error) {
      onDeleted?.(itemId);
    }
    setDeletingItemId(null);
  }

  async function updateStatus(item: MediaItemWithDetails, nextStatus: ItemStatus) {
    const previousStatus = item.status;
    const wasConsumed = optimisticConsumed.has(item.id);
    const willBeConsumed = nextStatus === 'completed';

    setOptimisticStatus((prev) => ({ ...prev, [item.id]: nextStatus }));
    setOptimisticConsumed((prev) => {
      const next = new Set(prev);
      if (willBeConsumed) {
        next.add(item.id);
      } else {
        next.delete(item.id);
      }
      return next;
    });

    setPendingStatusId(item.id);
    const supabase = createClient();
    const { error } = await supabase
      .from('media_items')
      .update({ status: nextStatus })
      .eq('id', item.id);

    if (!error) {
      if (willBeConsumed) {
        await supabase
          .from('consumption_records')
          .upsert(
            { user_id: userId, media_item_id: item.id },
            { onConflict: 'media_item_id,user_id' }
          );
      } else {
        await supabase
          .from('consumption_records')
          .delete()
          .eq('user_id', userId)
          .eq('media_item_id', item.id);
      }
    }

    if (!error) {
      onUpdated?.({
        ...item,
        status: nextStatus,
      });
      setOptimisticStatus((prev) => {
        const { [item.id]: _unused, ...rest } = prev;
        return rest;
      });
      setPendingStatusId(null);
      return;
    }

    // Roll back visual status if update fails.
    setOptimisticStatus((prev) => ({ ...prev, [item.id]: previousStatus }));
    setOptimisticConsumed((prev) => {
      const next = new Set(prev);
      if (wasConsumed) {
        next.add(item.id);
      } else {
        next.delete(item.id);
      }
      return next;
    });
    setPendingStatusId(null);
  }

  if (items.length === 0) {
    const typeLabel = activeType === 'all' ? 'items' : `${getTypeLabel(activeType as MediaType).toLowerCase()}s`;

    return (
      <div className="border border-stone-800/50 py-20 text-center space-y-3">
        <p className="font-serif text-2xl" style={{ color: 'oklch(0.38 0.005 60)' }}>
          No {typeLabel} yet
        </p>
        {isMember && (
          <p className="text-sm font-mono" style={{ color: 'oklch(0.32 0.005 60)' }}>
            Use the button above to add the first one.
          </p>
        )}
        {!isMember && (
          <p className="text-sm font-mono" style={{ color: 'oklch(0.32 0.005 60)' }}>
            Nothing here yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0 border border-stone-800/50">
      <div className="hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 px-4 py-4 border-b border-stone-800/60 text-xs font-mono uppercase tracking-wider text-stone-500">
        <span>Title</span>
        <span>Category</span>
        <span>Status</span>
        <span>Tags</span>
        <span>Added By</span>
        <span>Consumed By</span>
        <span className="text-right">View</span>
      </div>

      {items.map((item, index) => {
        const effectiveStatus = optimisticStatus[item.id] ?? item.status;
        const consumed = optimisticConsumed.has(item.id) || effectiveStatus === 'completed';
        const statusLabel = getStatusLabel(effectiveStatus, item.type);
        const statusClasses = getStatusColor(effectiveStatus);
        const consumedUsers = getConsumedUsers(item, currentUserNickname, consumed, userId);
        const isCurrentUserConsumed = currentUserNickname
          ? consumedUsers.includes(currentUserNickname)
          : consumed;
        const tagChips = getTagChips(item);

        return (
          <Fragment key={item.id}>
            <motion.div
              className="hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 px-4 py-4 border-b border-stone-800/50 items-start hover:bg-stone-900/20 transition-colors"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(0.012 * index, 0.2) }}
            >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-stone-100 font-light leading-snug truncate">{item.title}</p>
                {item.external_url && (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`View on ${item.external_source}`}
                    aria-label={`View "${item.title}" on ${item.external_source}`}
                    className="shrink-0 text-stone-600 hover:text-amber-500 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {item.metadata && (
                <p className="text-[11px] font-mono text-stone-600 truncate">{getMetaSummary(item)}</p>
              )}
            </div>

            <div className="text-stone-300 text-sm font-light pt-0.5">{getTypeLabel(item.type)}</div>

            <div className="shrink-0">
              {isMember ? (
                <Select
                  value={effectiveStatus}
                  onValueChange={(value) => updateStatus(item, value as ItemStatus)}
                >
                  <SelectTrigger className={cn('h-7 border text-[11px] font-mono px-2 py-0', statusClasses)} disabled={pendingStatusId === item.id}>
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
                <Badge className={cn('shrink-0 border text-xs', statusClasses)} variant={undefined}>
                  {statusLabel}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {tagChips.length === 0 ? (
                <span className="text-xs font-mono text-stone-700">-</span>
              ) : (
                tagChips.map((tag) => (
                  <Badge key={`${item.id}-${tag}`} variant="tag" className="text-[10px] uppercase">
                    {tag}
                  </Badge>
                ))
              )}
            </div>

            <div className="text-stone-200 text-sm font-mono pt-2 truncate">
              {item.added_by_profile?.nickname ?? 'Unknown'}
            </div>

            <div className="min-w-0 pt-0.5">
              {consumedUsers.length === 0 ? (
                <span className="text-xs font-mono" style={{ color: 'oklch(0.32 0.005 60)' }}>Nobody</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {consumedUsers.slice(0, 3).map((name) => (
                    <span
                      key={name}
                      className={`font-mono text-[10px] px-1.5 py-0.5 border truncate max-w-[90px] ${
                        isCurrentUserConsumed && name === currentUserNickname
                          ? 'border-amber-800/50 text-amber-400/80'
                          : 'border-stone-800/50 text-stone-400'
                      }`}
                    >
                      {name}
                    </span>
                  ))}
                  {consumedUsers.length > 3 && (
                    <span className="font-mono text-[10px] text-stone-600">+{consumedUsers.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-1">
              <ConsumedByDialog itemId={item.id} itemTitle={item.title} />
              {isMember && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditingItem(item)}>
                      <Pencil className="h-3 w-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-400 focus:text-red-300"
                      disabled={deletingItemId === item.id}
                      onClick={() => deleteItem(item.id)}
                    >
                      {deletingItemId === item.id ? (
                        <Spinner className="mr-2 h-3 w-3" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-2" />
                      )}
                      {deletingItemId === item.id ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            </motion.div>

            <motion.div
              className="md:hidden border-b border-stone-800/50 p-4 space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(0.012 * index, 0.2) }}
            >
            <div className="space-y-1">
              <div className="flex items-start gap-1.5">
                <p className="text-base text-stone-100 leading-snug break-words">{item.title}</p>
                {item.external_url && (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View "${item.title}" on ${item.external_source}`}
                    className="shrink-0 mt-1 text-stone-600 hover:text-amber-500 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <p className="text-xs font-mono text-stone-500">{getTypeLabel(item.type)}</p>
              {item.metadata && <p className="text-xs font-mono text-stone-600">{getMetaSummary(item)}</p>}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tagChips.length === 0 ? (
                <span className="text-xs font-mono text-stone-700">No tags</span>
              ) : (
                tagChips.map((tag) => (
                  <Badge key={`${item.id}-mobile-${tag}`} variant="tag" className="text-[10px] uppercase">
                    {tag}
                  </Badge>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-mono text-stone-500">Status</p>
              {isMember ? (
                <Select value={effectiveStatus} onValueChange={(value) => updateStatus(item, value as ItemStatus)}>
                  <SelectTrigger className={cn('h-11 border text-sm', statusClasses)} disabled={pendingStatusId === item.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions(item.type).map((statusOption) => (
                      <SelectItem key={`${item.id}-mobile-${statusOption.value}`} value={statusOption.value}>
                        {statusOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={cn('border text-xs', statusClasses)} variant={undefined}>
                  {statusLabel}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-mono text-stone-500">Consumed by</p>
              {consumedUsers.length === 0 ? (
                <p className="text-sm font-mono" style={{ color: 'oklch(0.38 0.005 60)' }}>Nobody yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {consumedUsers.slice(0, 5).map((name) => (
                    <span
                      key={name}
                      className="font-mono text-xs px-2 py-0.5 border border-stone-800/60 text-stone-300"
                    >
                      {name}
                    </span>
                  ))}
                  {consumedUsers.length > 5 && (
                    <span className="font-mono text-xs text-stone-600">+{consumedUsers.length - 5} more</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2 pt-1">
              <ConsumedByDialog itemId={item.id} itemTitle={item.title} />
              {isMember && (
                <EditMediaItemDialog item={item} userId={userId} onUpdated={(updated) => onUpdated?.(updated)}>
                  <Button variant="outline" size="sm" className="min-h-[44px] min-w-[80px]">
                    Edit
                  </Button>
                </EditMediaItemDialog>
              )}
              {isMember && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-[44px] min-w-[80px]"
                  onClick={() => deleteItem(item.id)}
                  disabled={deletingItemId === item.id}
                >
                  {deletingItemId === item.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-3 w-3" />
                      Deleting...
                    </span>
                  ) : (
                    'Delete'
                  )}
                </Button>
              )}
            </div>
            </motion.div>
          </Fragment>
        );
      })}
      {editingItem ? (
        <EditMediaItemDialog
          item={editingItem}
          userId={userId}
          onUpdated={(updated) => { onUpdated?.(updated); setEditingItem(null); }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        />
      ) : null}
    </div>
  );
}

function getTagChips(item: MediaItemWithDetails): string[] {
  const tags = new Set<string>();

  if (item.genre) {
    for (const part of item.genre.split(',')) {
      const cleaned = part.trim();
      if (cleaned) tags.add(cleaned.toUpperCase());
    }
  }

  const metadata = item.metadata as Record<string, unknown>;
  const candidates = [
    metadata.platform,
    metadata.publisher,
    metadata.director,
    metadata.creator,
    metadata.author,
    metadata.developer,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  for (const value of candidates) {
    if (tags.size >= 4) break;
    tags.add(value.toUpperCase());
  }

  return Array.from(tags).slice(0, 4);
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
