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
import { BookOpen, Clapperboard, ExternalLink, Gamepad2, MoreHorizontal, Pencil, Trash2, Tv } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getStatusLabel, getStatusOptions } from '@/types';
import { getStatusColor, getPeople, getVisibleTags } from '@/lib/utils';
import type { PersonKey } from '@/lib/utils';
import type { ItemStatus, MediaItem, MediaItemWithDetails, MediaType } from '@/types';
import { cn } from '@/lib/utils';
import { SimpleTooltip, TooltipProvider } from '@/components/ui/tooltip';
import { CommentsDialog } from './CommentsDialog';
import { EditMediaItemDialog } from './EditMediaItemDialog';

interface Props {
  items: MediaItemWithDetails[];
  consumedSet: Set<string>;
  activeType: MediaType | 'all';
  isMember: boolean;
  isOwner: boolean;
  userId: string;
  currentUserNickname: string | null;
  /** user_ids of the group's CURRENT members. When every one of them has
   *  completed an item, its row gets the "everyone finished" green wash. */
  memberIds?: string[];
  /** itemId -> user_ids that marked the item 'not interested'. Those members
   *  opted out, so they are skipped by the "everyone finished" wash. */
  notInterestedByItem?: Record<string, string[]>;
  activeTags?: string[];
  onToggleTag?: (tag: string) => void;
  onDeleted?: (itemId: string) => void;
  onUpdated?: (item: MediaItemWithDetails) => void;
}

const TAG_DISPLAY_LIMIT = 6;

// One glyph per media type — the label lives in the tooltip / aria-label.
const TYPE_ICONS: Record<MediaType, LucideIcon> = {
  movie: Clapperboard,
  tv_series: Tv,
  book: BookOpen,
  video_game: Gamepad2,
};

function TypeIcon({ type, className }: { type: MediaType; className?: string }) {
  const Icon = TYPE_ICONS[type] ?? Clapperboard;
  return (
    <SimpleTooltip label={getTypeLabel(type)} side="top">
      <span className="inline-flex">
        <Icon className={className} aria-label={getTypeLabel(type)} />
      </span>
    </SimpleTooltip>
  );
}

export function MediaTable({
  items,
  consumedSet,
  activeType,
  isMember,
  isOwner,
  userId,
  currentUserNickname,
  memberIds = [],
  notInterestedByItem = {},
  activeTags = [],
  onToggleTag,
  onDeleted,
  onUpdated,
}: Props) {
  const activeTagSet = new Set(activeTags);
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
    // Status is per-member: write only the current user's row in item_statuses.
    // The shared media_items row is never touched by a status change.
    const { error } = await supabase
      .from('item_statuses')
      .upsert(
        { media_item_id: item.id, user_id: userId, status: nextStatus },
        { onConflict: 'media_item_id,user_id' }
      );

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
    <TooltipProvider delayDuration={150}>
    <div className="space-y-0 border border-stone-800/50">
      <div className="hidden md:grid md:grid-cols-[16px_2.4fr_148px_1.8fr_1fr_1.4fr_76px] gap-4 px-4 py-4 border-b border-stone-800/60 text-xs font-mono uppercase tracking-wider text-stone-500">
        <span>
          <span className="sr-only">Type</span>
        </span>
        <span>Title</span>
        <span>Status</span>
        <span>Tags</span>
        <span>Added By</span>
        <span>Consumed By</span>
        <span className="text-right">View</span>
      </div>

      {items.map((item, index) => {
        const effectiveStatus = optimisticStatus[item.id] ?? item.status;
        const consumed = optimisticConsumed.has(item.id) || effectiveStatus === 'completed';
        const statusLabel = getStatusLabel(effectiveStatus);
        const statusClasses = getStatusColor(effectiveStatus);
        const consumedUsers = getConsumedUsers(item, currentUserNickname, consumed, userId);
        const isCurrentUserConsumed = currentUserNickname
          ? consumedUsers.includes(currentUserNickname)
          : consumed;
        // Chips show the item's tags only — the credited people are hidden tags
        // (searchable, never displayed) so the names aren't printed twice.
        const tagChips = getVisibleTags(item);
        // Personal opt-out: only THIS viewer's row is dimmed, and only when the
        // viewer is the one who marked it. Everyone else sees the item normally.
        const dimmed = effectiveStatus === 'not_interested';
        // Members who said "not interested" step out of the group verdict — the
        // viewer's own opt-out follows the optimistic status so the row reacts
        // to the dropdown immediately.
        const optedOut = new Set(notInterestedByItem[item.id] ?? []);
        if (dimmed) optedOut.add(userId);
        else optedOut.delete(userId);
        // Everyone-finished marker: every CURRENT member who did NOT opt out has
        // completed the item (completion ≡ having a consumption record; the
        // viewer's own state uses the optimistic value so the marker
        // appears/disappears immediately). One member opting out therefore no
        // longer blocks the marker for the rest of the group.
        const decidingMembers = memberIds.filter((memberId) => !optedOut.has(memberId));
        const completedByAll =
          decidingMembers.length > 0 &&
          decidingMembers.every((memberId) =>
            memberId === userId
              ? consumed
              : (item.consumption_records ?? []).some((record) => record.user_id === memberId)
          );
        // The opt-out reading wins over the green wash for the member who opted
        // out: they get a greyed-out row, everybody else still gets the wash.
        const showCompletedWash = completedByAll && !dimmed;
        // Dimming is applied CELL BY CELL, never to the row itself: a child can
        // never be more opaque than its parent, and the status selector has to
        // be able to come back to full strength on hover.
        const dimClass = dimmed ? 'opacity-45 saturate-0 transition-[opacity,filter] duration-200' : '';

        return (
          <Fragment key={item.id}>
            <motion.div
              className={cn(
                'group hidden md:grid md:grid-cols-[16px_2.4fr_148px_1.8fr_1fr_1.4fr_76px] gap-4 px-4 py-4 border-b border-stone-800/50 items-start hover:bg-stone-900/20 transition-colors',
                // Whole-group completion reads as a wash over the row, not a badge.
                showCompletedWash && 'bg-gradient-to-br from-emerald-700/35 via-emerald-900/15 via-40% to-transparent',
                // Opted out: every cell fades and loses its colour. The status
                // cell (below) undoes it on row hover, so the one control you
                // need to change your mind stays fully legible.
                dimmed && '[&>*]:opacity-45 [&>*]:saturate-0 [&>*]:transition-[opacity,filter] [&>*]:duration-200'
              )}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(0.012 * index, 0.2) }}
            >
            <div className="pt-0.5 text-stone-400">
              <TypeIcon type={item.type} className="h-4 w-4" />
            </div>

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
                <p className="text-[11px] font-mono text-stone-600 truncate">
                  <MetaSummary item={item} />
                </p>
              )}
            </div>

            <div
              className={cn(
                'shrink-0',
                // Hovering an opted-out row wakes up ONLY this cell.
                dimmed && 'group-hover:opacity-100 group-hover:saturate-100'
              )}
            >
              {isMember ? (
                <Select
                  value={effectiveStatus}
                  onValueChange={(value) => updateStatus(item, value as ItemStatus)}
                >
                  {/* The pill hugs its label (w-fit) instead of stretching across
                      the column, which left a dead stripe before the chevron.
                      justify-start + truncate keep the label hard against the
                      left padding: the shared trigger's justify-between and
                      line-clamp (a -webkit-box, which re-flows and re-centres a
                      label too long for the cell) are both overridden here. */}
                  <SelectTrigger
                    className={cn(
                      'h-7 w-fit max-w-full justify-start gap-1.5 border text-[11px] font-mono px-2 py-0 text-left',
                      '[&>span]:line-clamp-none [&>span]:truncate',
                      statusClasses
                    )}
                    disabled={pendingStatusId === item.id}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions().map((statusOption) => (
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
              <TagChipList
                itemId={item.id}
                tags={tagChips}
                activeTagSet={activeTagSet}
                onToggleTag={onToggleTag}
                keyPrefix="d"
                emptyLabel="-"
              />
            </div>

            <div className="text-stone-200 text-sm font-mono pt-2 truncate">
              {item.added_by_profile?.nickname ?? 'Unknown'}
            </div>

            <div className="min-w-0 pt-0.5">
              {consumedUsers.length === 0 ? (
                <span className="text-xs font-mono" style={{ color: 'oklch(0.32 0.005 60)' }}>Nobody</span>
              ) : completedByAll ? (
                <span
                  className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 border border-emerald-700/50 bg-emerald-900/30 text-emerald-300"
                  title={consumedUsers.join(', ')}
                >
                  Everyone ({consumedUsers.length})
                </span>
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
              <CommentsDialog
                itemId={item.id}
                itemTitle={item.title}
                userId={userId}
                currentUserNickname={currentUserNickname}
                isMember={isMember}
                isOwner={isOwner}
              />
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
              className={cn(
                'md:hidden border-b border-stone-800/50 p-4 space-y-3',
                showCompletedWash && 'bg-gradient-to-br from-emerald-700/35 via-emerald-900/15 via-40% to-transparent'
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(0.012 * index, 0.2) }}
            >
            {/* Title + quick status (title leads; status reads as a colored pill).
                Opted-out cards dim everything EXCEPT the status control — touch
                has no hover, so it simply stays legible. */}
            <div className="flex items-start justify-between gap-3">
              <div className={cn('min-w-0 space-y-1', dimClass)}>
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
                <p className="flex items-center gap-1 text-[11px] font-mono text-stone-500">
                  <TypeIcon type={item.type} className="h-3 w-3" />
                  {getTypeLabel(item.type)}
                </p>
                {item.metadata && (
                  <p className="text-[11px] font-mono text-stone-600"><MetaSummary item={item} /></p>
                )}
              </div>

              <div className="shrink-0">
                {isMember ? (
                  <Select value={effectiveStatus} onValueChange={(value) => updateStatus(item, value as ItemStatus)}>
                    <SelectTrigger
                      className={cn(
                        'h-9 w-fit max-w-full justify-start gap-1.5 border text-[11px] font-mono px-2 text-left',
                        '[&>span]:line-clamp-none [&>span]:truncate',
                        statusClasses
                      )}
                      disabled={pendingStatusId === item.id}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions().map((statusOption) => (
                        <SelectItem key={`${item.id}-mobile-${statusOption.value}`} value={statusOption.value}>
                          {statusOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={cn('border text-[11px]', statusClasses)} variant={undefined}>
                    {statusLabel}
                  </Badge>
                )}
              </div>
            </div>

            {/* Tags — only when present; finger-sized + tappable to filter */}
            {tagChips.length > 0 && (
              <div className={cn('flex flex-wrap gap-1.5', dimClass)}>
                <TagChipList
                  itemId={item.id}
                  tags={tagChips}
                  activeTagSet={activeTagSet}
                  onToggleTag={onToggleTag}
                  keyPrefix="m"
                  emptyLabel="No tags"
                  size="md"
                />
              </div>
            )}

            {/* Footer: who consumed it + actions (comments inline, rest in overflow) */}
            <div className={cn('flex items-end justify-between gap-2 pt-0.5', dimClass)}>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-stone-600 mb-1">Consumed by</p>
                {consumedUsers.length === 0 ? (
                  <p className="text-xs font-mono text-stone-600">Nobody yet</p>
                ) : completedByAll ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 border border-emerald-700/50 bg-emerald-900/30 text-emerald-300">
                    Everyone ({consumedUsers.length})
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {consumedUsers.slice(0, 4).map((name) => (
                      <span
                        key={name}
                        className={cn(
                          'font-mono text-[11px] px-1.5 py-0.5 border truncate max-w-[110px]',
                          isCurrentUserConsumed && name === currentUserNickname
                            ? 'border-amber-800/50 text-amber-400/80'
                            : 'border-stone-800/60 text-stone-300'
                        )}
                      >
                        {name}
                      </span>
                    ))}
                    {consumedUsers.length > 4 && (
                      <span className="font-mono text-[11px] text-stone-600 self-center">+{consumedUsers.length - 4}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <CommentsDialog
                  itemId={item.id}
                  itemTitle={item.title}
                  userId={userId}
                  currentUserNickname={currentUserNickname}
                  isMember={isMember}
                  isOwner={isOwner}
                />
                {isMember && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-11 w-11">
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
    </TooltipProvider>
  );
}

/**
 * Renders an item's tags as chips. When onToggleTag is provided each chip is a
 * toggle button (active = currently filtering by it); without it they are plain
 * read-only badges. Shows up to TAG_DISPLAY_LIMIT, then a "+N" overflow count.
 */
function TagChipList({
  itemId,
  tags,
  activeTagSet,
  onToggleTag,
  keyPrefix,
  emptyLabel,
  size = 'sm',
}: {
  itemId: string;
  tags: string[];
  activeTagSet: Set<string>;
  onToggleTag?: (tag: string) => void;
  keyPrefix: string;
  emptyLabel: string;
  /** 'md' gives finger-friendly chips for the mobile card. */
  size?: 'sm' | 'md';
}) {
  if (tags.length === 0) {
    return <span className="text-xs font-mono text-stone-700">{emptyLabel}</span>;
  }

  const shown = tags.slice(0, TAG_DISPLAY_LIMIT);
  const extra = tags.length - shown.length;
  const sizeClasses =
    size === 'md' ? 'px-2.5 py-1.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';

  return (
    <>
      {shown.map((tag) => {
        const active = activeTagSet.has(tag);
        if (!onToggleTag) {
          return (
            <Badge key={`${keyPrefix}-${itemId}-${tag}`} variant="tag" className={cn('uppercase', sizeClasses)}>
              {tag}
            </Badge>
          );
        }
        return (
          <button
            key={`${keyPrefix}-${itemId}-${tag}`}
            type="button"
            onClick={() => onToggleTag(tag)}
            aria-pressed={active}
            title={active ? `Remove tag filter: ${tag}` : `Filter by ${tag}`}
            className={cn(
              'cursor-pointer border font-mono uppercase tracking-wider transition-colors',
              sizeClasses,
              active
                ? 'border-amber-700/60 text-amber-400 bg-amber-950/30'
                : 'border-stone-800/60 text-stone-400 hover:border-stone-600 hover:text-stone-200 active:bg-stone-800/40'
            )}
          >
            {tag}
          </button>
        );
      })}
      {extra > 0 && (
        <span className="font-mono text-[10px] text-stone-600 self-center">+{extra}</span>
      )}
    </>
  );
}

/**
 * Renders the metadata summary line. Each credited person (director, creator,
 * author, developer) is listed by name — several are comma-separated — and each
 * name becomes a clickable external link when its page is known; everything else
 * is plain text. Returns null when empty.
 */
function MetaSummary({ item }: { item: MediaItem }) {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  const nodes: React.ReactNode[] = [];

  const pushCredit = (prefix: string, key: PersonKey) => {
    const people = getPeople(m, key);
    if (people.length === 0) return;
    nodes.push(
      <span key={key}>
        {prefix ? `${prefix} ` : ''}
        {people.map((person, i) => (
          <Fragment key={person.name}>
            {i > 0 && ', '}
            {person.url ? (
              <a
                href={person.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-amber-500 underline decoration-dotted underline-offset-2 transition-colors"
              >
                {person.name}
              </a>
            ) : (
              person.name
            )}
          </Fragment>
        ))}
      </span>
    );
  };

  pushCredit('dir.', 'director');
  pushCredit('cr.', 'creator');
  pushCredit('', 'author');
  pushCredit('', 'developer');
  if (m.release_year) nodes.push(<span key={nodes.length}>{String(m.release_year)}</span>);
  if (m.seasons) nodes.push(<span key={nodes.length}>{`${m.seasons} seasons`}</span>);
  if (m.duration_minutes) nodes.push(<span key={nodes.length}>{`${m.duration_minutes} min`}</span>);

  if (nodes.length === 0) return null;

  return (
    <>
      {nodes.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {node}
        </Fragment>
      ))}
    </>
  );
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
