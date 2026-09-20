'use client';

import { Check } from 'lucide-react';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { WarmTooltip, WarmTooltipGroup } from '@/components/micro/WarmTooltip';
import { CommentsDialog } from './CommentsDialog';
import { MediaPoster } from './MediaPoster';
import { StatusDot, statusOptions } from './StatusDot';
import { useItemStatus } from '@/hooks/useItemStatus';
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
  notInterestedByItem: Record<string, string[]>;
  onUpdated?: (item: MediaItemWithDetails) => void;
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
  notInterestedByItem,
  onUpdated,
}: Props) {
  const { statusOf, isConsumed, setStatus, savingId } = useItemStatus({
    userId,
    consumedSet,
    onUpdated,
  });

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

          return (
            <li key={item.id}>
              <article
                className={cn(
                  // `translate-y-0` for the same reason the posters carry
                  // `scale-100`: Tailwind v4 lifts cards with the standalone
                  // `translate` property, which starts at `none` and will not
                  // interpolate into a length — and `transition-transform` does
                  // not name it. Both halves have to be said out loud or the
                  // lift is a jump.
                  'group relative translate-y-0 overflow-hidden rounded-[var(--radius-md)] border transition-[border-color,translate] duration-[var(--duration-standard)] ease-[var(--ease-standard)]',
                  everyone ? 'border-emerald-500/40' : 'border-white/10',
                  'hover:-translate-y-0.5 hover:border-white/30',
                  status === 'not_interested' && 'opacity-55',
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
                <div className="absolute left-1.5 top-1.5">
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

                {everyone ? (
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
                    <h3
                      className="truncate text-[12.5px] font-semibold leading-tight tracking-[-0.015em] text-stone-50"
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                    <p className="truncate text-[11px] leading-tight text-stone-400">
                      {[year, credit].filter(Boolean).join(' \u00b7 ') || getStatusLabel(status)}
                    </p>
                  </div>
                  <CommentsDialog
                    itemId={item.id}
                    itemTitle={item.title}
                    userId={userId}
                    currentUserNickname={currentUserNickname}
                    isMember={isMember}
                    isOwner={isOwner}
                    triggerClassName="-mb-0.5 h-7 w-7 shrink-0 text-stone-400 hover:text-stone-100"
                  />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </WarmTooltipGroup>
  );
}
