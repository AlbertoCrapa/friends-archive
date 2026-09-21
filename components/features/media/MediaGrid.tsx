'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { WarmTooltip, WarmTooltipGroup } from '@/components/micro/WarmTooltip';
import { CommentsDialog } from './CommentsDialog';
import { ItemSheet } from './ItemSheet';
import { MediaPoster } from './MediaPoster';
import { StatusDot, statusOptions } from './StatusDot';
import { useItemDelete } from '@/hooks/useItemDelete';
import { useItemStatus, type ItemStatusController } from '@/hooks/useItemStatus';
import { cn, getPeople, isFinishedByEveryone } from '@/lib/utils';
import { getStatusLabel, getStatusOptions } from '@/types';
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';

const CREDIT_KEY: Record<MediaType, 'director' | 'creator' | 'author' | 'developer'> = {
  movie: 'director',
  tv_series: 'creator',
  book: 'author',
  video_game: 'developer',
};

const STATUS_OPTIONS = statusOptions(getStatusOptions());

interface Props {
  items: MediaItemWithDetails[];
  consumedSet: Set<string>;
  isMember: boolean;
  isOwner: boolean;
  userId: string;
  currentUserNickname: string | null;
  memberIds: string[];
  /** Nicknames for those members, so the item sheet can name the whole room. */
  members?: { id: string; nickname: string }[];
  notInterestedByItem: Record<string, string[]>;
  activeTags?: string[];
  onToggleTag?: (tag: string) => void;
  onDeleted?: (itemId: string) => void;
  onRestored?: (item: MediaItemWithDetails) => void;
  /** Which item's sheet is open, when the archive owns that (deep links). */
  openId?: string | null;
  onOpenId?: (itemId: string | null) => void;
  onUpdated?: (item: MediaItemWithDetails) => void;
  /** Selection mode: a cover gathers instead of opening. Owned by the archive. */
  selecting?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
  /** Sends ONE item elsewhere, from its sheet. */
  onTransfer?: (item: MediaItemWithDetails) => void;
  /**
   * The status machinery, when it is OWNED ABOVE this list. The archive lifts
   * it so the list view, the covers view and the selection tray all read and
   * write one set of facts — without it, switching view resets what the viewer
   * has marked finished back to whatever the server said on page load.
   */
  statusController?: ItemStatusController;
}

/**
 * The covers view: the same archive, read by its artwork.
 *
 * A list is the right shape when you are looking something up. When you are
 * deciding what to watch, the poster is the thing you actually recognise — so
 * here the poster IS the card, edge to edge, and everything else is laid over
 * it. That buys density: eight covers across a desk, three across a phone,
 * which is the difference between browsing a shelf and scrolling one.
 *
 * Text over artwork only works if it is never asked to survive on its own, so
 * each card carries a scrim that is opaque where the words are and gone by the
 * time it reaches the middle of the image.
 */
export function MediaGrid({
  items,
  consumedSet,
  isMember,
  isOwner,
  userId,
  currentUserNickname,
  memberIds,
  members = [],
  notInterestedByItem,
  activeTags = [],
  onToggleTag,
  onDeleted,
  onRestored,
  openId,
  onOpenId,
  onUpdated,
  selecting = false,
  selectedIds,
  onToggleSelect,
  onTransfer,
  statusController,
}: Props) {
  // Hooks cannot be conditional, so the local one is always made and simply
  // goes unused when the archive hands its own down.
  const localStatus = useItemStatus({ userId, consumedSet, onUpdated });
  const { statusOf, isConsumed, setStatus, savingId } = statusController ?? localStatus;
  // Tracked by id, so the open sheet follows the item through edits and status
  // changes rather than showing a copy taken when it opened. The archive owns
  // the id when it can, because it is in the URL and therefore linkable.
  const [localOpenId, setLocalOpenId] = useState<string | null>(null);
  const currentOpenId = openId !== undefined ? openId : localOpenId;
  const setOpenId = onOpenId ?? setLocalOpenId;
  const deleteItem = useItemDelete({ onDeleted, onRestored });

  const openItem = useMemo(
    () => (currentOpenId ? items.find((item) => item.id === currentOpenId) ?? null : null),
    [items, currentOpenId],
  );

  const roster = useMemo(() => {
    const named = new Map(members.map((member) => [member.id, member.nickname]));
    const ids = memberIds.length > 0 ? memberIds : members.map((member) => member.id);
    return [userId, ...ids.filter((id) => id !== userId)].map((id) => ({
      id,
      nickname: id === userId ? currentUserNickname ?? 'You' : named.get(id) ?? 'Member',
    }));
  }, [members, memberIds, userId, currentUserNickname]);

  if (items.length === 0) return null;

  return (
    <WarmTooltipGroup>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
        {items.map((item, index) => {
          const status = statusOf(item);
          const credit = getPeople(item.metadata, CREDIT_KEY[item.type])[0]?.name;
          const meta = item.metadata as { release_year?: number; publication_year?: number };
          const year = meta?.release_year ?? meta?.publication_year;
          const everyone = isFinishedByEveryone({
            itemId: item.id,
            consumerIds: (item.consumption_records ?? []).map((record) => record.user_id),
            memberIds,
            notInterestedByItem,
            viewerId: userId,
            viewerConsumed: isConsumed(item.id),
          });

          const selected = !!selectedIds?.has(item.id);

          return (
            <li key={item.id}>
              <article
                onClick={() => (selecting ? onToggleSelect?.(item.id) : setOpenId(item.id))}
                className={cn(
                  'cursor-pointer',
                  // `translate-y-0` for the same reason the posters carry
                  // `scale-100`: Tailwind v4 lifts cards with the standalone
                  // `translate` property, which starts at `none` and will not
                  // interpolate into a length — and `transition-transform` does
                  // not name it. Both halves have to be said out loud or the
                  // lift is a jump.
                  'group relative translate-y-0 overflow-hidden rounded-[var(--radius-md)] border transition-[border-color,translate] duration-[var(--duration-standard)] ease-[var(--ease-standard)]',
                  everyone ? 'border-emerald-500/40' : 'border-white/10',
                  'hover:-translate-y-0.5 hover:border-white/30',
                  // A picked cover is ringed rather than dimmed: the artwork is
                  // the only way you recognise what you are holding.
                  selected && 'border-amber-400 ring-2 ring-amber-400/70 hover:border-amber-400',
                  status === 'not_interested' && !selected && 'opacity-55',
                )}
              >
                <MediaPoster
                  src={item.image_url}
                  type={item.type}
                  size="xl"
                  priority={index < 12}
                  className="rounded-none border-0"
                />

                {/* Controls live in the corners, where the artwork has least to
                    say, and stay put: a card that only shows its controls on
                    hover is a card a phone can never fully use. */}
                {selecting ? null : (
                <div className="absolute left-1.5 top-1.5" onClick={(event) => event.stopPropagation()}>
                  {isMember ? (
                    <span className={savingId === item.id ? 'pointer-events-none opacity-60' : undefined}>
                      <GlideSelect
                        compact
                        ariaLabel={`Your status for ${item.title}`}
                        align="left"
                        value={status}
                        onChange={(next) => setStatus(item, next as ItemStatus)}
                        label={<StatusDot status={status} />}
                        options={STATUS_OPTIONS}
                      />
                    </span>
                  ) : (
                    <span
                      title={getStatusLabel(status)}
                      className="grid h-5 w-5 place-items-center rounded-full bg-stone-950/75"
                    >
                      <StatusDot status={status} />
                    </span>
                  )}
                </div>
                )}

                {/* Top right is one slot with two tenants, and gathering wins
                    it: while you are picking, "is this one picked" is the only
                    question the corner has to answer. */}
                {selecting ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border shadow-[var(--shadow-2)] transition-colors',
                      selected
                        ? 'border-amber-400 bg-amber-400 text-stone-950'
                        : 'border-white/50 bg-stone-950/70 text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                  </span>
                ) : everyone ? (
                  <WarmTooltip content="Everyone in the group finished this">
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-stone-950 shadow-[var(--shadow-2)]">
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                  </WarmTooltip>
                ) : null}

                {/* The scrim is part of the picture, not a panel on top of it:
                    solid under the words, gone by the middle of the frame. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-stone-950 via-stone-950/92 via-42% to-transparent" />

                <div className="absolute inset-x-0 bottom-0 flex items-end gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    {/* The whole cover is the click target for a pointer; the
                        title is the one a keyboard can reach, and it says what
                        pressing it opens. */}
                    <h3
                      className="min-w-0 truncate text-[12.5px] font-semibold leading-tight tracking-[-0.015em] text-stone-50"
                      title={item.title}
                    >
                      <button
                        type="button"
                        aria-haspopup={selecting ? undefined : 'dialog'}
                        aria-pressed={selecting ? selected : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (selecting) onToggleSelect?.(item.id);
                          else setOpenId(item.id);
                        }}
                        className="max-w-full cursor-pointer truncate text-left align-bottom transition-colors hover:text-amber-300"
                      >
                        {item.title}
                      </button>
                    </h3>
                    <p className="truncate text-[11px] leading-tight text-stone-400">
                      {[year, credit].filter(Boolean).join(' \u00b7 ') || getStatusLabel(status)}
                    </p>
                  </div>
                  {selecting ? null : (
                  <span onClick={(event) => event.stopPropagation()} className="shrink-0">
                  <CommentsDialog
                    itemId={item.id}
                    itemTitle={item.title}
                    userId={userId}
                    currentUserNickname={currentUserNickname}
                    isMember={isMember}
                    isOwner={isOwner}
                    triggerClassName="-mb-0.5 h-7 w-7 shrink-0 text-stone-400 hover:text-stone-100"
                  />
                  </span>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {/* Same sheet the list opens — a cover and a row are two ways of finding
          the same thing, and they must lead to the same place. */}
      <ItemSheet
        item={openItem}
        open={!!openItem}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        userId={userId}
        currentUserNickname={currentUserNickname}
        isMember={isMember}
        isOwner={isOwner}
        members={roster}
        status={openItem ? statusOf(openItem) : 'plan_to_consume'}
        consumed={openItem ? isConsumed(openItem.id) : false}
        saving={!!openItem && savingId === openItem.id}
        onStatus={(next) => {
          if (openItem) setStatus(openItem, next);
        }}
        onUpdated={onUpdated}
        onDelete={
          isMember && openItem && onDeleted
            ? () => {
                deleteItem(openItem);
                setOpenId(null);
              }
            : undefined
        }
        onTransfer={
          isMember && openItem && onTransfer
            ? () => {
                setOpenId(null);
                onTransfer(openItem);
              }
            : undefined
        }
        onToggleTag={onToggleTag}
        activeTags={activeTags}
      />
    </WarmTooltipGroup>
  );
}
