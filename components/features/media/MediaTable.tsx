'use client';

// ============================================================================
// MediaTable — the archive read as a list.
//
// A list is what you use when you are looking something up, so every row
// answers the same four questions in the same four places: what is it, what is
// it about, how far has the GROUP got, and what did YOU say about it. Anything
// that is not one of those four has been taken out of the row — who added a
// title is not why anyone opens this page, and it is still one click away in
// the item's menu.
//
// The row carries two ways to act on it: a gesture, which does the one thing a
// gesture is good for, and a menu, which holds everything, always, for anyone
// not holding a phone.
// ============================================================================

import { Fragment, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ExternalLink,
  EyeOff,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { SwipeRow } from '@/components/micro/SwipeRow';
import { WarmTooltip, WarmTooltipGroup } from '@/components/micro/WarmTooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useItemDelete } from '@/hooks/useItemDelete';
import { useItemStatus } from '@/hooks/useItemStatus';
import { getPeople, getVisibleTags, cn } from '@/lib/utils';
import type { PersonKey } from '@/lib/utils';
import { getStatusLabel, getStatusOptions, getTypeLabel } from '@/types';
import type { ItemStatus, MediaItem, MediaItemWithDetails, MediaType } from '@/types';
import { CommentsDialog } from './CommentsDialog';
import { ItemSheet } from './ItemSheet';
import { StatusDot, statusOptions } from './StatusDot';
import { EditMediaItemDialog } from './EditMediaItemDialog';
import { MediaPoster, PosterGlow, TYPE_ICONS } from './MediaPoster';

// Tags earn less room on a phone: four of them wrap to a second line, which is
// what made one row twice the height of its neighbour.
const TAG_LIMIT = 4;
const TAG_LIMIT_NARROW = 2;
const PRIORITY_ROWS = 8;
const STATUS_OPTIONS = statusOptions(getStatusOptions());

const CREDIT_PREFIX: [string, PersonKey][] = [
  ['dir.', 'director'],
  ['cr.', 'creator'],
  ['', 'author'],
  ['', 'developer'],
];

export interface RosterMember {
  id: string;
  nickname: string;
}

interface Props {
  items: MediaItemWithDetails[];
  consumedSet: Set<string>;
  activeType?: MediaType | 'all';
  isMember: boolean;
  isOwner: boolean;
  userId: string;
  currentUserNickname: string | null;
  /** user_ids of the group's CURRENT members — one meter slot each. */
  memberIds?: string[];
  /** Nicknames for those members, so the meter can say who is who. */
  members?: RosterMember[];
  /** itemId -> user_ids that marked the item 'not interested'. */
  notInterestedByItem?: Record<string, string[]>;
  activeTags?: string[];
  onToggleTag?: (tag: string) => void;
  onDeleted?: (itemId: string) => void;
  /** Puts a deleted item back where it was when the undo is pressed. */
  onRestored?: (item: MediaItemWithDetails) => void;
  /** Which item's sheet is open, when the archive owns that (deep links). */
  openId?: string | null;
  onOpenId?: (itemId: string | null) => void;
  onUpdated?: (item: MediaItemWithDetails) => void;
}

export function MediaTable({
  items,
  consumedSet,
  activeType = 'all',
  isMember,
  isOwner,
  userId,
  currentUserNickname,
  memberIds = [],
  members = [],
  notInterestedByItem = {},
  activeTags = [],
  onToggleTag,
  onDeleted,
  onRestored,
  openId,
  onOpenId,
  onUpdated,
}: Props) {
  const { statusOf, isConsumed, setStatus, savingId } = useItemStatus({
    userId,
    consumedSet,
    onUpdated,
  });
  const [editing, setEditing] = useState<MediaItemWithDetails | null>(null);
  // The open sheet is tracked by ID, not by object: the item it shows is
  // re-read from `items` on every render, so a status change, an edit or a new
  // comment reaches the open sheet instead of leaving a stale copy on screen.
  //
  // The archive above owns that id when it can — it is in the URL, so a sheet
  // can be linked to — and falls back to local state wherever this list is
  // used on its own.
  const [localOpenId, setLocalOpenId] = useState<string | null>(null);
  const currentOpenId = openId !== undefined ? openId : localOpenId;
  const setOpenId = onOpenId ?? setLocalOpenId;
  const deleteItem = useItemDelete({ onDeleted, onRestored });
  const activeTagSet = new Set(activeTags);

  // The meter has one slot per member, in a fixed order with the viewer first,
  // so the same person is always the same slot on every row of the list.
  const roster: RosterMember[] = (() => {
    const named = new Map(members.map((member) => [member.id, member.nickname]));
    const ids = memberIds.length > 0 ? memberIds : members.map((member) => member.id);
    const ordered = [userId, ...ids.filter((id) => id !== userId)].filter((id) =>
      ids.includes(id) || id === userId,
    );
    return ordered.map((id) => ({
      id,
      nickname: id === userId ? currentUserNickname ?? 'You' : named.get(id) ?? 'Member',
    }));
  })();

  const openItem = useMemo(
    () => (currentOpenId ? items.find((item) => item.id === currentOpenId) ?? null : null),
    [items, currentOpenId],
  );

  if (items.length === 0) {
    const label = activeType === 'all' ? 'items' : getTypeLabel(activeType).toLowerCase();
    return (
      <div className="rounded-[var(--radius-lg)] bg-stone-900 p-12 text-center border border-white/[0.07]">
        <p className="text-[15px] font-semibold text-stone-100">No {label} yet</p>
        <p className="mt-1 text-sm text-stone-500">
          {isMember ? 'Add the first one and the archive starts here.' : 'Nothing here yet.'}
        </p>
      </div>
    );
  }

  return (
    <WarmTooltipGroup>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <ArchiveRow
            key={item.id}
            item={item}
            index={index}
            roster={roster}
            status={statusOf(item)}
            consumed={isConsumed(item.id)}
            saving={savingId === item.id}
            optedOut={new Set(notInterestedByItem[item.id] ?? [])}
            isMember={isMember}
            isOwner={isOwner}
            userId={userId}
            currentUserNickname={currentUserNickname}
            activeTagSet={activeTagSet}
            onToggleTag={onToggleTag}
            onStatus={(next) => setStatus(item, next)}
            onEdit={() => setEditing(item)}
            onDelete={() => deleteItem(item)}
            onOpen={() => setOpenId(item.id)}
          />
        ))}
      </ul>

      {/* Clicking a row opens the item itself: what it is, what it costs you,
          where the group has got to, and what everyone said. The list stays
          mounted behind it, so closing the sheet puts you back exactly where
          you were in the archive. */}
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
          isMember && openItem
            ? () => {
                deleteItem(openItem);
                setOpenId(null);
              }
            : undefined
        }
        onToggleTag={onToggleTag}
        activeTags={activeTags}
      />

      {editing ? (
        <EditMediaItemDialog
          item={editing}
          userId={userId}
          onUpdated={(updated) => {
            onUpdated?.(updated);
            setEditing(null);
          }}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </WarmTooltipGroup>
  );
}

interface RowProps {
  item: MediaItemWithDetails;
  index: number;
  roster: RosterMember[];
  status: ItemStatus;
  consumed: boolean;
  saving: boolean;
  optedOut: Set<string>;
  isMember: boolean;
  isOwner: boolean;
  userId: string;
  currentUserNickname: string | null;
  activeTagSet: Set<string>;
  onToggleTag?: (tag: string) => void;
  onStatus: (status: ItemStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

function ArchiveRow({
  item,
  index,
  roster,
  status,
  consumed,
  saving,
  optedOut,
  isMember,
  isOwner,
  userId,
  currentUserNickname,
  activeTagSet,
  onToggleTag,
  onStatus,
  onEdit,
  onDelete,
  onOpen,
}: RowProps) {
  const TypeGlyph = TYPE_ICONS[item.type];
  const tags = getVisibleTags(item);
  const skipped = status === 'not_interested';
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * Where the press started, so a PULL is never mistaken for a TAP.
   *
   * The row is draggable (that is how the delete drawer opens) and clicking it
   * opens the item. A gesture that moved more than a few pixels was a drag,
   * whatever the browser then decides to call it, and must not also open a
   * sheet on top of the drawer it just opened.
   */
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  // The viewer's own state is optimistic, so the meter has to prefer it over
  // the server's consumption records for their own slot.
  const finished = new Set((item.consumption_records ?? []).map((record) => record.user_id));
  if (consumed) finished.add(userId);
  else finished.delete(userId);
  const opted = new Set(optedOut);
  if (skipped) opted.add(userId);
  else opted.delete(userId);

  const deciding = roster.filter((member) => !opted.has(member.id));
  const everyone = deciding.length > 0 && deciding.every((member) => finished.has(member.id));

  // Pulling the row aside offers one thing: remove it.
  //
  // Finishing something already has a control sitting on the row, in the same
  // place on every row, one tap away — putting it behind a gesture as well made
  // the drawer a second menu you had to read. A drawer with a single red button
  // in it needs no reading at all, which is the only reason to pull a row.
  //
  // `commit: false` takes away the full-swipe shortcut: this destroys something
  // for the whole group, so it costs a pull AND a tap, never a flick.
  const actions = isMember
    ? [
        {
          id: 'delete',
          label: 'Delete',
          tone: 'out' as const,
          icon: <Trash2 className="h-4 w-4" />,
          commit: false,
          onSelect: onDelete,
        },
      ]
    : [];

  return (
    <li className="relative list-none">
      <SwipeRow
        label={`Actions for ${item.title}`}
        actions={actions}
        disabled={!isMember}
        handle={false}
        // The two ways of acting on a row must not be usable at the same time:
        // while the menu is open the row is pinned, and while the row is being
        // pulled the menu cannot open (see the trigger below).
        locked={menuOpen}
        className="mi-swipe-plain"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, delay: Math.min(index * 0.01, 0.16) }}
          onPointerDown={(event) => {
            pressAt.current = { x: event.clientX, y: event.clientY };
          }}
          onClick={(event) => {
            const start = pressAt.current;
            pressAt.current = null;
            // Anything that handles its own click — a tag, a link, the status
            // control, the menu — stops the event before it reaches this, so
            // only the row's own surface opens the sheet.
            if (event.defaultPrevented) return;
            if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
            onOpen();
          }}
          className={cn(
            // A grid, not a wrapping flex row.
            //
            // On a phone the controls belong UNDER the text and BESIDE the
            // artwork — the poster spans both rows — so the row is as tall as
            // its content and no taller. Wrapped in a flex row they were pushed
            // below the poster instead, which left a band of dead space under
            // every short row and made no two rows the same height.
            // From sm up the same three pieces lay out in three columns.
            'group relative isolate grid cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-[12px] border p-2.5 transition-colors sm:grid-cols-[48px_minmax(0,1fr)_auto]',
            everyone ? 'border-emerald-500/40' : 'border-white/[0.07]',
            'hover:border-white/20',
            skipped && 'opacity-55',
          )}
        >
          {/* The row takes its tint from its own artwork: a blurred copy of the
              poster, faded out well before it reaches any text. */}
          <PosterGlow src={item.image_url} shape="row" className="-z-10" />

          <MediaPoster
            src={item.image_url}
            type={item.type}
            size="md"
            zoomOnHover
            priority={index < PRIORITY_ROWS}
            className="row-span-2 sm:row-span-1"
          />

          <div className="min-w-0 space-y-1 py-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {/* The pointer can click anywhere on the row; a keyboard needs
                  one real control, and the title is the one that says what it
                  will open. */}
              <h3 className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.015em] text-stone-50">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen();
                  }}
                  aria-haspopup="dialog"
                  className="max-w-full cursor-pointer truncate text-left align-bottom transition-colors hover:text-amber-300"
                >
                  {item.title}
                </button>
              </h3>
              {item.external_url ? (
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${item.title} on ${item.external_source}`}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 text-stone-600 transition-colors hover:text-amber-400"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-stone-500">
              <TypeGlyph className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">{getTypeLabel(item.type)}</span>
              <span className="truncate">
                <MetaSummary item={item} />
              </span>
            </p>

            {tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {tags.slice(0, TAG_LIMIT).map((tag, i) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleTag?.(tag);
                    }}
                    aria-pressed={activeTagSet.has(tag)}
                    disabled={!onToggleTag}
                    className={cn(
                      'h-[20px] rounded-[var(--radius-sm)] px-1.5 text-[11px] font-medium transition-colors',
                      onToggleTag && 'cursor-pointer',
                      // Past the second one, the chips are a desktop luxury.
                      i >= TAG_LIMIT_NARROW && 'hidden sm:inline-flex',
                      activeTagSet.has(tag)
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-stone-800/80 text-stone-400 hover:bg-stone-700 hover:text-stone-200',
                    )}
                  >
                    {tag}
                  </button>
                ))}
                {tags.length > TAG_LIMIT_NARROW ? (
                  <span className="text-[11px] text-stone-600 sm:hidden">
                    +{tags.length - TAG_LIMIT_NARROW}
                  </span>
                ) : null}
                {tags.length > TAG_LIMIT ? (
                  <span className="hidden text-[11px] text-stone-600 sm:inline">
                    +{tags.length - TAG_LIMIT}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Column 2 row 2 on a phone, column 3 on a desk. Every control in
              here does its own thing and stops the row's click. */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-2 sm:col-start-3 sm:row-start-1 sm:self-center sm:justify-end"
          >
            <FinishedMeter
              roster={roster}
              finished={finished}
              opted={opted}
              viewerId={userId}
              everyone={everyone}
            />

            {isMember ? (
              <span className={saving ? 'pointer-events-none opacity-60' : undefined}>
                <GlideSelect
                  ariaLabel={`Your status for ${item.title}`}
                  align="right"
                  value={status}
                  onChange={(next) => onStatus(next as ItemStatus)}
                  label={<StatusDot status={status} />}
                  options={STATUS_OPTIONS}
                />
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
                <StatusDot status={status} />
                {getStatusLabel(status)}
              </span>
            )}

            <CommentsDialog
              itemId={item.id}
              itemTitle={item.title}
              userId={userId}
              currentUserNickname={currentUserNickname}
              isMember={isMember}
              isOwner={isOwner}
              triggerClassName="h-8 w-8"
            />

            {isMember ? (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`More actions for ${item.title}`}
                    // Radix opens this on POINTERDOWN, which on a swipeable row
                    // means the menu is already up by the time you have moved a
                    // pixel — press the dots, pull, and you get a menu and a
                    // half-open drawer at once. Opening on click instead makes
                    // the two mutually exclusive: a pull is a pull, and the
                    // click that ends it is swallowed by the row.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onStatus(consumed ? 'plan_to_consume' : 'completed')}>
                    {consumed ? (
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Check className="mr-2 h-3.5 w-3.5" />
                    )}
                    {consumed ? 'Mark not finished' : 'Mark finished'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onStatus(skipped ? 'plan_to_consume' : 'not_interested')}
                  >
                    <EyeOff className="mr-2 h-3.5 w-3.5" />
                    {skipped ? 'Put it back' : 'Not interested'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="opacity-100">
                    <span className="text-[11.5px] text-stone-500">
                      Added by {item.added_by_profile?.nickname ?? 'someone who left'}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* No pending state: the row goes the instant this is
                      chosen, and the toast holds both the confirmation and the
                      way back. */}
                  <DropdownMenuItem className="text-red-400 focus:text-red-300" onSelect={onDelete}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </motion.div>
      </SwipeRow>
    </li>
  );
}

/**
 * How far the GROUP has got with one title: one slot per member, always in the
 * same order, the viewer's own slot taller than the rest so you can find
 * yourself without reading anything. Names live in the tooltip, because the
 * question the list has to answer at a glance is "how many", not "who".
 */
function FinishedMeter({
  roster,
  finished,
  opted,
  viewerId,
  everyone,
}: {
  roster: RosterMember[];
  finished: Set<string>;
  opted: Set<string>;
  viewerId: string;
  everyone: boolean;
}) {
  if (roster.length === 0) return null;

  const deciding = roster.filter((member) => !opted.has(member.id));
  const done = deciding.filter((member) => finished.has(member.id));
  const name = (member: RosterMember) => (member.id === viewerId ? 'You' : member.nickname);

  const lines = [
    done.length > 0 ? `${done.map(name).join(', ')} finished` : 'Nobody has finished this',
    deciding.length - done.length > 0
      ? `${deciding.filter((m) => !finished.has(m.id)).map(name).join(', ')} to go`
      : null,
    opted.size > 0
      ? `${roster.filter((m) => opted.has(m.id)).map(name).join(', ')} opted out`
      : null,
  ].filter(Boolean) as string[];

  return (
    <WarmTooltip content={lines.join(' · ')}>
      <div className="flex shrink-0 cursor-default items-center gap-1.5" aria-label={lines.join('. ')}>
        {roster.length <= 10 ? (
          <span aria-hidden className="flex items-end gap-[3px]">
            {roster.map((member) => {
              const isViewer = member.id === viewerId;
              // Opting out is not the same as not having finished, so the slot
              // stays — shorter and flatter, a member who stepped out of the
              // count rather than one who is still in it.
              const out = opted.has(member.id);
              const state = out
                ? 'bg-stone-600/50'
                : finished.has(member.id)
                  ? 'bg-emerald-500'
                  : 'bg-stone-600';
              const height = out ? 'h-[6px]' : isViewer ? 'h-[17px]' : 'h-[12px]';
              return (
                <span key={member.id} className={cn('w-[4px] rounded-full', state, height)} />
              );
            })}
          </span>
        ) : (
          <span aria-hidden className="h-[6px] w-12 overflow-hidden rounded-full bg-stone-700">
            <span
              className="block h-full rounded-full bg-emerald-500"
              style={{ width: `${deciding.length ? (done.length / deciding.length) * 100 : 0}%` }}
            />
          </span>
        )}
        <span
          className={cn(
            'text-[11.5px] tabular-nums',
            everyone ? 'text-emerald-400' : 'text-stone-500',
          )}
        >
          {everyone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : `${done.length}/${deciding.length}`}
        </span>
      </div>
    </WarmTooltip>
  );
}

/**
 * The line under the title: who made it and when. Each credited person is a
 * link when the provider gave us a page for them.
 */
function MetaSummary({ item }: { item: MediaItem }) {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const nodes: React.ReactNode[] = [];

  for (const [prefix, key] of CREDIT_PREFIX) {
    const people = getPeople(meta, key);
    if (people.length === 0) continue;
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
                onClick={(event) => event.stopPropagation()}
                className="underline decoration-dotted underline-offset-2 transition-colors hover:text-amber-400"
              >
                {person.name}
              </a>
            ) : (
              person.name
            )}
          </Fragment>
        ))}
      </span>,
    );
  }

  // Films and games carry a release year, books a publication year. Same fact,
  // two provider spellings.
  const year = meta.release_year ?? meta.publication_year;
  if (year) nodes.push(<span key="year">{String(year)}</span>);
  if (meta.seasons) nodes.push(<span key="seasons">{`${meta.seasons} seasons`}</span>);
  if (meta.duration_minutes) nodes.push(<span key="runtime">{`${meta.duration_minutes} min`}</span>);

  if (nodes.length === 0) return <>{getTypeLabel(item.type)}</>;

  return (
    <>
      {nodes.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-stone-700"> / </span>}
          {node}
        </Fragment>
      ))}
    </>
  );
}
