'use client';

// ============================================================================
// ItemSheet — what happens when you actually click one.
//
// A row and a cover both answer "what is in this archive". Neither answers the
// question a group of friends opens an archive to settle: SHALL WE, and WHAT
// DID YOU THINK. This is the surface for that, and it is built around three
// things in that order:
//
//   1. WHAT IT COSTS YOU. One number, in the same unit for all four media
//      types: minutes. A film's runtime, a series' episodes times their
//      length, a game's average playthrough, a book's pages at reading pace.
//      Nothing else on the sheet is set as large, because nothing else is
//      argued about as much.
//   2. WHERE EVERYONE IS. One line per member, live: who finished it, who is
//      in the middle of it, who has opted out. The list can only show you the
//      viewer's own state — here the whole room is on screen.
//   3. WHAT THEY SAID. The notes people leave when they finish (a column that
//      has been in the schema, and loaded by the archive, since the beginning
//      and has never had anywhere to appear), their rating when the ratings
//      migration is in, and the comment thread — inline, beside the artwork it
//      is about, instead of behind another dialog.
//
// Everything above the fold is drawn from data the archive ALREADY has, so the
// sheet is fully readable the instant it opens. The synopsis, the world's
// score and the billed cast arrive a moment later from the provider — once per
// title, then cached (hooks/useItemStory.ts). No artwork is re-fetched: the
// poster is the same file the row was already showing, asked for one size up.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  FolderInput,
  Link2,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { PeekRating, RATING_WORDS } from '@/components/micro/PeekRating';
import { StatusMark } from '@/components/micro/StatusMark';
import { WarmTooltip, WarmTooltipGroup } from '@/components/micro/WarmTooltip';
import { useItemStory } from '@/hooks/useItemStory';
import { useItemVerdicts, type Verdict } from '@/hooks/useItemVerdicts';
import {
  cn,
  formatMinutes,
  formatRelativeDate,
  getPeople,
  getVisibleTags,
  posterAtDetailSize,
} from '@/lib/utils';
import type { PersonKey } from '@/lib/utils';
import { getStatusLabel, getStatusOptions, getTypeLabel } from '@/types';
import type { ItemStatus, MediaItemWithDetails, MediaType, WhereEntry } from '@/types';
import { CommentThread } from './CommentThread';
import { EditMediaItemDialog } from './EditMediaItemDialog';
import { MediaPoster, PosterGlow, TYPE_ICONS } from './MediaPoster';
import { StatusDot, statusOptions } from './StatusDot';
import { StoreMark, hasStoreMark } from './StoreMark';

const STATUS_OPTIONS = statusOptions(getStatusOptions());

/** Whose name sits under the title, per type. */
const CREDIT_KEY: Record<MediaType, PersonKey> = {
  movie: 'director',
  tv_series: 'creator',
  book: 'author',
  video_game: 'developer',
};

const CREDIT_LABEL: Record<PersonKey, string> = {
  director: 'Directed by',
  creator: 'Created by',
  author: 'Written by',
  developer: 'Made by',
};

/** Whose name the provider is, for the attribution line every one of them asks for. */
const SOURCE_LABEL: Record<string, string> = {
  tmdb: 'TMDB',
  openlibrary: 'Open Library',
  rawg: 'RAWG',
};

/** The order the room reads in: you first, then by how far along people are. */
const STATUS_RANK: Record<ItemStatus, number> = {
  completed: 0,
  consuming: 1,
  plan_to_consume: 2,
  not_interested: 3,
};

export interface ItemSheetProps {
  item: MediaItemWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentUserNickname: string | null;
  isMember: boolean;
  isOwner: boolean;
  /** The group's roster, so the room can name everyone — not only the finishers. */
  members: { id: string; nickname: string }[];
  /** The viewer's own live status, owned by the list this sheet was opened from. */
  status: ItemStatus;
  consumed: boolean;
  saving?: boolean;
  onStatus: (next: ItemStatus) => void;
  onUpdated?: (item: MediaItemWithDetails) => void;
  /** Provided where deleting is offered; the caller owns the undo. */
  onDelete?: () => void;
  /** Opens the send dialog for this one title. Members only. */
  onTransfer?: () => void;
  onToggleTag?: (tag: string) => void;
  activeTags?: string[];
}

export function ItemSheet(props: ItemSheetProps) {
  const { item, open, onOpenChange } = props;
  const reduced = useReducedMotion();

  // Phones get a sheet that is pulled up from the bottom edge and thrown back
  // down; desks get a panel. Same component, two shapes — measured rather than
  // guessed, because the drag has to be wired differently for each.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const dragControls = useDragControls();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && item ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[var(--z-modal)] bg-black/70 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  'fixed z-[calc(var(--z-modal)+1)] flex flex-col overflow-hidden border border-white/[0.09] bg-[var(--color-surface)] shadow-[var(--shadow-3)]',
                  // Phone: anchored to the bottom edge, never quite full height,
                  // so the archive stays visible behind it and the sheet reads
                  // as something laid over the list rather than a new page.
                  'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[20px] border-b-0',
                  // Desk: a panel, centred, with the two columns side by side.
                  'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:h-[min(86vh,820px)] md:max-h-none md:w-[min(1080px,calc(100vw-4rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-lg)] md:border-b',
                )}
                initial={reduced ? { opacity: 0 } : narrow ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 8 }}
                animate={reduced ? { opacity: 1 } : narrow ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : narrow ? { y: '100%' } : { opacity: 0, scale: 0.98 }}
                transition={
                  narrow
                    ? { type: 'spring', stiffness: 460, damping: 44, mass: 0.9 }
                    : { duration: 0.26, ease: [0.23, 1, 0.32, 1] }
                }
                // The gesture is bound to the grab bar only. A sheet that drags
                // from anywhere fights its own scrolling, and the fight is
                // always won by whichever one you did not mean.
                drag={narrow ? 'y' : false}
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.02, bottom: 0.55 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 120 || info.velocity.y > 700) onOpenChange(false);
                }}
              >
                {/* Keyed by item: opening a different title through a link
                    starts the panel's own state over rather than carrying the
                    last one's draft note into it. */}
                <SheetBody
                  key={item.id}
                  {...props}
                  item={item}
                  dragControls={dragControls}
                  narrow={narrow}
                />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function SheetBody({
  item,
  open,
  onOpenChange,
  userId,
  currentUserNickname,
  isMember,
  isOwner,
  members,
  status,
  consumed,
  saving,
  onStatus,
  onUpdated,
  onDelete,
  onTransfer,
  onToggleTag,
  activeTags = [],
  dragControls,
  narrow,
}: ItemSheetProps & {
  item: MediaItemWithDetails;
  dragControls: ReturnType<typeof useDragControls>;
  narrow: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  const { story, state: storyState } = useItemStory(item.external_id, open);
  const { verdicts, statuses, loaded, ratingsEnabled, saveMine } = useItemVerdicts({
    itemId: item.id,
    enabled: open,
  });

  const TypeGlyph = TYPE_ICONS[item.type];
  const creditKey = CREDIT_KEY[item.type];
  const credits = getPeople(item.metadata, creditKey);
  const tags = getVisibleTags(item);
  const activeTagSet = new Set(activeTags);
  const meta = item.metadata as {
    release_year?: number;
    publication_year?: number;
    duration_minutes?: number;
    seasons?: number;
    platform?: string;
  };
  const year = meta?.release_year ?? meta?.publication_year;
  const bigPoster = posterAtDetailSize(item.image_url);

  // The time cost, from whichever source knows it. An item entered by hand can
  // still carry a runtime, and that is worth as much as the provider's.
  const minutes = story?.minutes ?? (item.type === 'movie' ? meta?.duration_minutes : undefined);
  const minutesBasis =
    story?.minutes && story.minutes_basis
      ? story.minutes_basis
      : minutes
        ? 'Runtime'
        : undefined;

  /**
   * The room: every current member, with where they are on THIS item.
   *
   * A completion outranks a status row — finishing is a fact, the status is a
   * label — and the viewer's own line comes from the list they opened this
   * from, so the sheet and the row can never disagree about what the viewer
   * just clicked.
   */
  const finishedBy = useMemo(
    () => new Map(verdicts.map((verdict) => [verdict.userId, verdict])),
    [verdicts],
  );

  const room = useMemo(() => {
    const rows = members.map((member) => {
      const isYou = member.id === userId;
      const verdict = finishedBy.get(member.id);
      const memberStatus: ItemStatus = isYou
        ? status
        : verdict
          ? 'completed'
          : statuses[member.id] ?? 'plan_to_consume';
      return {
        id: member.id,
        nickname: isYou ? currentUserNickname ?? 'You' : member.nickname,
        isYou,
        status: memberStatus,
        verdict: isYou && !consumed ? undefined : verdict,
      };
    });
    return rows
      // Someone reading a public archive they are not in is not part of the
      // room, and a line saying they have it "Planned" would be a fiction.
      .filter((row) => isMember || !row.isYou)
      .sort((a, b) => {
        if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rank !== 0) return rank;
        return a.nickname.localeCompare(b.nickname);
      });
  }, [members, userId, finishedBy, status, statuses, currentUserNickname, consumed, isMember]);

  // Everyone else's verdict. The viewer's own is right above, in the box they
  // can edit it in — printing it twice would read as two different people.
  const said = room.filter(
    (entry) => !entry.isYou && entry.verdict && (entry.verdict.note || entry.verdict.rating),
  );
  /**
   * The room in one line. Six names is a list you read; "3 of 5 finished" is a
   * state you glance at, and it is the same sentence the archive's row-level
   * meter is drawing in dots.
   */
  const tally = useMemo(() => {
    const counts = { completed: 0, consuming: 0, planned: 0, out: 0 };
    for (const entry of room) {
      if (entry.status === 'completed') counts.completed += 1;
      else if (entry.status === 'consuming') counts.consuming += 1;
      else if (entry.status === 'not_interested') counts.out += 1;
      else counts.planned += 1;
    }
    const deciding = room.length - counts.out;
    return { ...counts, deciding, everyone: deciding > 0 && counts.completed === deciding };
  }, [room]);

  const groupRating = useMemo(() => {
    const values = verdicts.map((verdict) => verdict.rating).filter((n): n is number => !!n);
    if (values.length === 0) return null;
    return { average: values.reduce((sum, n) => sum + n, 0) / values.length, count: values.length };
  }, [verdicts]);

  const mine = finishedBy.get(userId);

  return (
    <WarmTooltipGroup>
      {/* The grab bar. Present only on a phone, and the only thing the sheet
          can be dragged by. */}
      {narrow ? (
        <div
          onPointerDown={(event) => dragControls.start(event)}
          className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>
      ) : null}

      {/* Actions live in one bar at the top, in the same place in both shapes. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2 md:px-4">
        <span className="inline-flex min-w-0 items-center gap-2 text-[11.5px] text-stone-500">
          <TypeGlyph className="h-3.5 w-3.5 shrink-0 text-stone-600" aria-hidden />
          <span className="truncate">{getTypeLabel(item.type)}</span>
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {/* A link to THIS title inside the archive. The sheet's id is in the
              address bar the whole time it is open (see GroupMediaSection), so
              sending a friend a film is one press, and what they open is the
              conversation about it rather than the top of a list. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-stone-400 hover:text-stone-100"
            title="Copy link to this item"
            onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}?item=${item.id}`;
              try {
                await navigator.clipboard.writeText(url);
                toast({
                  tone: 'success',
                  message: (
                    <>
                      Link to <b>{item.title}</b> copied
                    </>
                  ),
                });
              } catch {
                toast({ message: 'Could not copy the link — your browser blocked it.' });
              }
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          {item.external_url ? (
            <a href={item.external_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-stone-400 hover:text-stone-100">
                {SOURCE_LABEL[item.external_source ?? ''] ?? 'Source'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          ) : null}
          {isMember && onTransfer ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-stone-400 hover:text-stone-100"
              title="Send to another archive"
              onClick={onTransfer}
            >
              <FolderInput className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {isMember ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-stone-400 hover:text-stone-100"
              title="Edit"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {isMember && onDelete ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-stone-400 hover:text-red-400"
              title="Delete"
              onClick={() => {
                // The row leaves the archive and the toast holds the undo, so
                // the sheet has nothing left to show.
                onOpenChange(false);
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-stone-400 hover:text-stone-100" title="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:overflow-hidden">
        {/* ── The work ───────────────────────────────────────────────────── */}
        <div className="relative md:h-full md:overflow-y-auto md:overscroll-contain">
          {/* The film tints its own sheet: a blurred copy of the poster we
              already have in cache, never a second image off the network. */}
          <PosterGlow src={item.image_url} shape="card" className="h-64 opacity-70" />

          <div className="relative px-4 pb-6 pt-4 md:px-6">
            <div className="flex gap-4">
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
                className="shrink-0"
              >
                <MediaPoster
                  src={bigPoster}
                  type={item.type}
                  size="xl"
                  priority
                  className="w-[104px] shadow-[var(--shadow-3)] sm:w-[132px]"
                />
              </motion.div>

              <div className="min-w-0 flex-1 pt-0.5">
                <DialogPrimitive.Title asChild>
                  <h2 className="type-head text-[clamp(1.4rem,5vw,2.1rem)] text-stone-50">
                    {item.title}
                  </h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  {getTypeLabel(item.type)}
                  {year ? `, ${year}` : ''}. What the group has said about it, and what it is.
                </DialogPrimitive.Description>

                <p className="mt-1.5 text-[13px] leading-relaxed text-stone-400">
                  {year ? <span className="tabular-nums">{year}</span> : null}
                  {year && credits.length > 0 ? <span className="text-stone-700"> · </span> : null}
                  {credits.length > 0 ? (
                    <>
                      <span className="text-stone-600">{CREDIT_LABEL[creditKey]} </span>
                      {credits.map((person, index) => (
                        <span key={person.name}>
                          {index > 0 ? ', ' : ''}
                          {person.url ? (
                            <a
                              href={person.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-stone-300 underline decoration-dotted underline-offset-2 hover:text-amber-400"
                            >
                              {person.name}
                            </a>
                          ) : (
                            <span className="text-stone-300">{person.name}</span>
                          )}
                        </span>
                      ))}
                    </>
                  ) : null}
                </p>

                {/* The two numbers, side by side: what it asks of you, and what
                    the world made of it. */}
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <TimeCost minutes={minutes} basis={minutesBasis} pending={storyState === 'loading'} />
                  {story?.score ? <ScoreRing score={story.score} /> : null}
                </div>
              </div>
            </div>

            {story?.tagline ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.06 }}
                className="mt-5 text-[13.5px] italic leading-relaxed text-stone-400"
              >
                “{story.tagline}”
              </motion.p>
            ) : null}

            <Synopsis text={story?.synopsis} state={storyState} hasLink={!!item.external_id} />

            {story?.people && story.people.length > 0 ? (
              <section className="mt-5">
                <h3 className="label-quiet">With</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-stone-300">
                  {story.people.join(' · ')}
                </p>
              </section>
            ) : null}

            <WhereToGet
              where={story?.where}
              country={story?.where_country}
              source={story?.where_source}
              type={item.type}
            />

            {tags.length > 0 ? (
              <section className="mt-5">
                <h3 className="label-quiet">Tags</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = activeTagSet.has(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          onToggleTag?.(tag);
                          onOpenChange(false);
                        }}
                        disabled={!onToggleTag}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                          active
                            ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                            : 'border-white/[0.09] bg-white/[0.03] text-stone-400 hover:border-white/20 hover:text-stone-200',
                          onToggleTag ? 'cursor-pointer' : 'cursor-default',
                        )}
                        title={onToggleTag ? `Show everything tagged ${tag}` : undefined}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {story?.facts && story.facts.length > 0 ? (
              <section className="mt-5">
                <h3 className="label-quiet">Details</h3>
                <dl className="mt-2 divide-y divide-white/[0.05] border-y border-white/[0.05]">
                  {story.facts.map((fact) => (
                    <div key={fact.label} className="flex items-baseline justify-between gap-4 py-1.5">
                      <dt className="text-[12px] text-stone-500">{fact.label}</dt>
                      <dd className="text-right text-[12.5px] text-stone-300">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <p className="mt-5 text-[11.5px] leading-relaxed text-stone-600">
              Added by{' '}
              <span className="text-stone-400">
                {item.added_by_profile?.nickname ?? 'someone who left'}
              </span>{' '}
              · {formatRelativeDate(item.created_at)}
              {item.external_source ? (
                <>
                  <br />
                  Story and artwork from {SOURCE_LABEL[item.external_source]}, cached — this item is
                  read from them once, not on every visit.
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* ── The group ──────────────────────────────────────────────────── */}
        <div className="border-t border-white/[0.06] bg-stone-950/40 md:h-full md:overflow-y-auto md:overscroll-contain md:border-l md:border-t-0">
          <div className="space-y-6 px-4 py-5 md:px-5">
            {isMember ? (
              <YourLine
                status={status}
                consumed={consumed}
                saving={saving}
                mine={mine}
                ratingsEnabled={ratingsEnabled}
                onStatus={onStatus}
                onSaveNote={async (note) => {
                  const { error } = await saveMine(userId, currentUserNickname, { note });
                  toast(
                    error
                      ? { message: 'Could not save your note. Please try again.' }
                      : { tone: 'success', message: 'Your note is with the group' },
                  );
                }}
                onRate={async (rating) => {
                  const { error } = await saveMine(userId, currentUserNickname, { rating });
                  if (error) toast({ message: 'Could not save your rating. Please try again.' });
                }}
              />
            ) : null}

            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="label-quiet flex items-center gap-1.5">
                  The room
                  {tally.everyone ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-300">
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      All in
                    </span>
                  ) : null}
                </h3>
                {groupRating ? (
                  <WarmTooltip
                    content={`${groupRating.count} ${groupRating.count === 1 ? 'friend has' : 'friends have'} rated it`}
                  >
                    <span className="text-[11.5px] text-stone-500">
                      Friends{' '}
                      <span className="font-semibold tabular-nums text-amber-400">
                        {groupRating.average.toFixed(1)}
                      </span>
                      <span className="text-stone-700">/5</span>
                    </span>
                  </WarmTooltip>
                ) : null}
              </div>

              <p className="mt-1.5 text-[12px] text-stone-500">
                <span className="text-stone-300 tabular-nums">
                  {tally.completed} of {tally.deciding}
                </span>{' '}
                finished
                {tally.consuming > 0 ? (
                  <>
                    <span className="text-stone-700"> · </span>
                    <span className="tabular-nums text-amber-400/90">{tally.consuming}</span> in
                    progress
                  </>
                ) : null}
                {tally.out > 0 ? (
                  <>
                    <span className="text-stone-700"> · </span>
                    <span className="tabular-nums">{tally.out}</span> sitting it out
                  </>
                ) : null}
              </p>

              <ul className="mt-2 space-y-0.5">
                {room.map((entry, index) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.28 }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-1.5 py-1.5',
                      entry.isYou && 'bg-white/[0.04]',
                    )}
                  >
                    <StatusMark
                      status={entry.status}
                      tone={entry.isYou ? 'you' : 'group'}
                      size={18}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[13px]',
                        entry.isYou ? 'font-semibold text-stone-100' : 'text-stone-300',
                        entry.status === 'not_interested' && 'text-stone-600',
                      )}
                    >
                      {entry.nickname}
                      {entry.isYou ? <span className="ml-1 text-[11px] text-stone-500">you</span> : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-stone-600">
                      {entry.verdict
                        ? formatRelativeDate(entry.verdict.consumedAt)
                        : getStatusLabel(entry.status)}
                    </span>
                  </motion.li>
                ))}
              </ul>
              {!loaded ? (
                <p className="mt-2 inline-flex items-center gap-2 text-[11px] text-stone-600">
                  <Spinner className="h-3 w-3" />
                  Catching up with everyone…
                </p>
              ) : null}
            </section>

            {said.length > 0 ? (
              <section>
                <h3 className="label-quiet">What they said</h3>
                <ul className="mt-2.5 space-y-2">
                  {said.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-semibold text-stone-200">
                          {entry.nickname}
                        </span>
                        {entry.verdict?.rating ? (
                          <span className="shrink-0">
                            <PeekRating
                              value={entry.verdict.rating}
                              readOnly
                              size={14}
                              tone="group"
                              ariaLabel={`${entry.nickname} rated it ${entry.verdict.rating} out of 5`}
                            />
                          </span>
                        ) : null}
                      </div>
                      {entry.verdict?.note ? (
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-stone-400 [overflow-wrap:anywhere]">
                          {entry.verdict.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="label-quiet flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-stone-600" aria-hidden />
                Conversation
                {commentCount ? <span className="text-stone-600">({commentCount})</span> : null}
              </h3>
              <div className="mt-2.5">
                <CommentThread
                  itemId={item.id}
                  userId={userId}
                  currentUserNickname={currentUserNickname}
                  isMember={isMember}
                  isOwner={isOwner}
                  active={open}
                  scroll={false}
                  onCount={setCommentCount}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      {editing ? (
        <EditMediaItemDialog
          item={item}
          userId={userId}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(false);
          }}
          onUpdated={(updated) => {
            onUpdated?.(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </WarmTooltipGroup>
  );
}

/**
 * The headline number: how much of your life this asks for.
 *
 * Four media types, one unit. It is the only figure on the sheet set at display
 * size, because "is it three hours or sixty" is the question a group actually
 * has to agree on before anything else matters.
 */
function TimeCost({
  minutes,
  basis,
  pending,
}: {
  minutes?: number;
  basis?: string;
  pending: boolean;
}) {
  const label = formatMinutes(minutes);

  if (!label) {
    return pending ? (
      <div className="h-[42px] w-28 animate-pulse rounded-[var(--radius-sm)] bg-white/[0.05]" />
    ) : null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
    >
      <span className="type-display block text-[1.9rem] leading-none text-stone-50 tabular-nums">
        {label}
      </span>
      {basis ? <span className="mt-1 block text-[11px] text-stone-500">{basis}</span> : null}
    </motion.div>
  );
}

/** The world's score, drawn as the fraction of the ring it fills. */
function ScoreRing({ score }: { score: { value: number; count?: number; label: string } }) {
  const value = Math.max(0, Math.min(10, score.value));
  const reduced = useReducedMotion();

  return (
    <WarmTooltip
      content={`${score.label}${score.count ? ` · ${score.count.toLocaleString()} votes` : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative inline-grid h-11 w-11 place-items-center">
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
            <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <motion.circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              initial={{ pathLength: reduced ? value / 10 : 0 }}
              animate={{ pathLength: value / 10 }}
              transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
            />
          </svg>
          <span className="text-[13px] font-semibold tabular-nums text-stone-100">
            {value.toFixed(1)}
          </span>
        </span>
        <span className="max-w-[7rem] text-[11px] leading-tight text-stone-500">{score.label}</span>
      </div>
    </WarmTooltip>
  );
}

/** What the heading calls the row, per medium. */
const WHERE_TITLE: Record<MediaType, string> = {
  movie: 'Where to watch',
  tv_series: 'Where to watch',
  book: 'Where to read',
  video_game: 'Where to play',
};

/** The suffix on a chip. Streaming says nothing — it is the default reading. */
const WHERE_KIND_LABEL: Record<WhereEntry['kind'], string | null> = {
  stream: null,
  rent: 'rent',
  buy: 'buy',
};

/**
 * WHERE YOU CAN ACTUALLY GET IT — the one part of the sheet that answers
 * "fine, but can we watch it tonight".
 *
 * Absent means nobody told us, and the row simply is not there: an empty
 * "Where to watch" heading would read as "nowhere", which is a much stronger
 * claim than we are entitled to make. Every chip is a link out, so this is
 * the only place on the sheet that can end the evening's argument.
 */
function WhereToGet({
  where,
  country,
  source,
  type,
}: {
  where?: WhereEntry[];
  country?: string;
  source?: string;
  type: MediaType;
}) {
  if (!where || where.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="label-quiet">
        {WHERE_TITLE[type]}
        {country ? <span className="ml-1.5 text-stone-600">in {country}</span> : null}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {where.map((place) => {
          const kind = WHERE_KIND_LABEL[place.kind];
          return (
            <a
              key={`${place.kind}:${place.name}`}
              href={place.url}
              target="_blank"
              rel="noopener noreferrer"
              title={
                place.via === 'justwatch'
                  ? `${place.name} has it — opens the JustWatch page, which knows the way in`
                  : `Opens ${place.name}`
              }
              className={cn(
                'group flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] py-1 pr-2.5 text-[11.5px] text-stone-300 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200',
                // A mark sits in the chip's own inset. Films get a logo from
                // the provider's CDN, game stores get an inlined brand glyph,
                // and anything we cannot draw honestly gives the space back to
                // the name rather than showing an empty square.
                place.logo_url || hasStoreMark(place.name) ? 'pl-1' : 'pl-2.5',
              )}
            >
              {place.logo_url ? (
                <img
                  src={place.logo_url}
                  alt=""
                  width={18}
                  height={18}
                  loading="lazy"
                  className="h-[18px] w-[18px] rounded-[5px] object-cover"
                />
              ) : (
                <StoreMark
                  name={place.name}
                  className="h-[18px] w-[18px] p-[2px] text-stone-400 transition-colors group-hover:text-amber-300"
                />
              )}
              <span>{place.name}</span>
              {kind ? <span className="text-stone-500 group-hover:text-amber-500/70">{kind}</span> : null}
              <ArrowUpRight className="h-3 w-3 text-stone-600 group-hover:text-amber-400" />
            </a>
          );
        })}
      </div>
      {source ? (
        <p className="mt-1.5 text-[11px] text-stone-600">Availability from {source}</p>
      ) : null}
    </section>
  );
}

/** The synopsis, clamped to four lines until asked to open. */
function Synopsis({
  text,
  state,
  hasLink,
}: {
  text?: string;
  state: string;
  hasLink: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!text) {
    if (state === 'loading' && hasLink) {
      return (
        <div className="mt-5 space-y-2" aria-hidden>
          {[0, 1, 2].map((line) => (
            <div
              key={line}
              className="h-3 animate-pulse rounded bg-white/[0.05]"
              style={{ width: `${[96, 90, 62][line]}%` }}
            />
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    <section className="mt-5">
      <motion.p
        layout="position"
        className={cn(
          'whitespace-pre-line text-[13.5px] leading-relaxed text-stone-300',
          !open && 'line-clamp-4',
        )}
      >
        {text}
      </motion.p>
      {text.length > 260 ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="mt-1.5 cursor-pointer text-[11.5px] text-amber-500/80 transition-colors hover:text-amber-400"
        >
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </section>
  );
}

/**
 * The viewer's own line: where they are, and what they thought.
 *
 * The note only exists once you have finished something, because that is
 * exactly what the row it is stored on means (one consumption record per member
 * per item). Un-finishing therefore takes the note with it, which is why the
 * control says so before you do it.
 */
function YourLine({
  status,
  consumed,
  saving,
  mine,
  ratingsEnabled,
  onStatus,
  onSaveNote,
  onRate,
}: {
  status: ItemStatus;
  consumed: boolean;
  saving?: boolean;
  mine?: Verdict;
  ratingsEnabled: boolean;
  onStatus: (next: ItemStatus) => void;
  onSaveNote: (note: string | null) => Promise<void>;
  onRate: (rating: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(mine?.note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const lastLoaded = useRef<string | null>(null);

  // The note arrives a moment after the sheet opens. Adopt it once — and never
  // over something the viewer has started typing.
  useEffect(() => {
    const incoming = mine?.note ?? '';
    if (lastLoaded.current === null && incoming) {
      lastLoaded.current = incoming;
      setDraft(incoming);
    }
  }, [mine?.note]);

  const dirty = (mine?.note ?? '') !== draft.trim();

  const save = useCallback(async () => {
    setSavingNote(true);
    await onSaveNote(draft.trim() || null);
    setSavingNote(false);
  }, [draft, onSaveNote]);

  return (
    <section className="rounded-[var(--radius-md)] border border-white/[0.07] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="label-quiet">You</h3>
        <span className={saving ? 'pointer-events-none opacity-60' : undefined}>
          <GlideSelect
            ariaLabel="Your status for this item"
            align="right"
            value={status}
            onChange={(next) => onStatus(next as ItemStatus)}
            label={<StatusDot status={status} />}
            options={STATUS_OPTIONS}
          />
        </span>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {consumed ? (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              {ratingsEnabled ? (
                <div className="flex items-center justify-between gap-3 pb-3">
                  <PeekRating
                    value={mine?.rating ?? 0}
                    onChange={(next) => void onRate(next || null)}
                    size={22}
                    ariaLabel="Your rating"
                  />
                  <span className="text-[11px] text-stone-500">
                    {mine?.rating ? RATING_WORDS[mine.rating - 1] : 'Rate it'}
                  </span>
                </div>
              ) : null}

              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="What did you make of it? Your friends see this."
                className="text-sm"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-stone-600">{draft.length}/500</span>
                <Button size="sm" onClick={save} disabled={!dirty || savingNote}>
                  {savingNote ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      Saving…
                    </span>
                  ) : (
                    'Save note'
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-2.5 text-[12.5px] leading-relaxed text-stone-500"
          >
            <button
              type="button"
              onClick={() => onStatus('completed')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-stone-300 underline decoration-dotted underline-offset-4 transition-colors hover:text-emerald-400"
            >
              <Check className="h-3.5 w-3.5" />
              Mark it finished
            </button>{' '}
            to leave the group a note about it.
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
