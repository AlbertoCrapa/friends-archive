'use client';

// ============================================================================
// DashboardContent — the page you land on, which has exactly one job: get you
// into the right archive.
//
// So the groups come first and they are made of their own artwork: a strip of
// the covers most recently added to each one, which is both the quickest way
// to recognise a group and the most honest summary of what is in it. The
// counting comes after, because nobody logs in to read a number.
// ============================================================================

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Compass, Globe, Lock, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFormStatus } from 'react-dom';
import { cancelGroupAccessRequest } from '@/app/actions/join-requests';
import { MediaPoster, TYPE_ICONS } from '@/components/features/media/MediaPoster';
import { cn, safeImageUrl } from '@/lib/utils';
import type { Group, GroupRole, ItemStatus, MediaType } from '@/types';
import { getTypePluralLabel } from '@/types';

type GroupRow = Group & {
  role: GroupRole;
  itemCount: number;
  memberCount: number;
  typeCounts: Record<MediaType, number>;
  covers: string[];
};

/**
 * A group you have asked to join and have not been let into yet. It wears the
 * same card as the groups you are in, because on this page it is the same kind
 * of thing — an archive you are trying to reach. What it cannot wear is their
 * contents: until the owner says yes, the covers, the counts and the member
 * list are not yours to read, so the card's middle is given over to saying so.
 */
interface PendingGroup {
  id: string;
  name: string;
  description: string | null;
  visibility: Group['visibility'];
  requestedAt: string;
}

interface RecentItem {
  id: string;
  title: string;
  type: MediaType;
  groupId: string;
  groupName: string;
  createdAt: string;
  imageUrl: string | null;
}

interface Props {
  groups: GroupRow[];
  pendingGroups: PendingGroup[];
  ownedCount: number;
  atLimit: boolean;
  plan: string;
  maxOwned: number | null;
  totalItems: number;
  consumedCount: number;
  addedCount: number;
  typeCounts: Record<MediaType, number>;
  statusCounts: Record<ItemStatus, number>;
  recentItems: RecentItem[];
}

const EASE = [0.23, 1, 0.32, 1] as const;
const TYPES: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];

/** Your own progress. These are states, not categories, and each one is
 *  written out beside its colour so the colour never has to carry it alone. */
const STATUS_STEPS: { key: ItemStatus; label: string; className: string }[] = [
  { key: 'completed', label: 'Finished', className: 'bg-emerald-500' },
  { key: 'consuming', label: 'In progress', className: 'bg-warn-500' },
  { key: 'plan_to_consume', label: 'Planned', className: 'bg-stone-500' },
  { key: 'not_interested', label: 'Skipped', className: 'bg-stone-700' },
];

// The locale is pinned, not inherited. Node and the browser disagree about the
// default one, and a date that renders "16 Sept" on the server and "Sep 16" in
// the browser throws away the whole hydrated tree.
function formatDay(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function DashboardContent({
  groups,
  pendingGroups,
  ownedCount,
  atLimit,
  plan,
  maxOwned,
  totalItems,
  consumedCount,
  addedCount,
  typeCounts,
  statusCounts,
  recentItems,
}: Props) {
  const typeData = TYPES.map((type) => ({ type, count: typeCounts[type] ?? 0 })).filter(
    (row) => row.count > 0,
  );
  const statusTotal = STATUS_STEPS.reduce((sum, step) => sum + (statusCounts[step.key] ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Stacked on a phone: the title gets its own line instead of sharing one
          with a button that ends up hanging off the subtitle. */}
      <motion.header
        className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div>
          <h1 className="page-title">My archives</h1>
          <p className="mt-1 text-[13.5px] text-stone-500">
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}, you own {ownedCount}
            {maxOwned !== null ? ` of ${maxOwned}` : ''}
            {pendingGroups.length > 0 ? (
              <>
                <span aria-hidden className="px-1.5 text-stone-700">
                  ·
                </span>
                {pendingGroups.length} {pendingGroups.length === 1 ? 'request' : 'requests'}{' '}
                awaiting approval
              </>
            ) : null}
            {plan !== 'free' ? (
              <span className="ml-2 rounded-[var(--radius-sm)] bg-amber-500/15 px-1.5 py-0.5 text-[11.5px] font-medium text-amber-300">
                {plan}
              </span>
            ) : null}
          </p>
        </div>
        {atLimit ? (
          <Button variant="secondary" size="sm" className="gap-2" disabled>
            <Plus className="h-3.5 w-3.5" />
            Group limit reached
          </Button>
        ) : (
          <Link href="/groups/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              New group
            </Button>
          </Link>
        )}
      </motion.header>

      {/* The groups you have asked for live in the same grid as the ones you
          have, at the end of it. They are the same card on purpose: on this
          page they are the same kind of thing, an archive you are trying to
          reach, and splitting them into their own list downstairs would mean
          scrolling past everything to find out whether anyone let you in. What
          changes is the inside — no shelf, no counts, and a way to take the
          request back. */}
      {groups.length + pendingGroups.length > 0 ? (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: Math.min(i * 0.05, 0.3) }}
              >
                <GroupCard group={group} />
              </motion.div>
            ))}
            {pendingGroups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  ease: EASE,
                  delay: Math.min((groups.length + i) * 0.05, 0.3),
                }}
              >
                <PendingGroupCard group={group} />
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-5">
            {/*
              Four equal boxes holding four unrelated numbers is a scoreboard,
              not a summary: nothing in the arrangement says which number matters
              or how any of them relate, and two of them were the same fact told
              twice. One sentence with its own breakdown under it says all four
              and means something: how far through everything you are, what the
              rest of it is doing, and the two counts that give it scale.
            */}
            <Panel
              className="lg:col-span-3"
              title="Your progress"
              caption="Everything you can reach, and how far through it you are."
            >
              {totalItems === 0 ? (
                <p className="text-[13px] text-stone-500">Nothing to track yet.</p>
              ) : (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span
                      className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-stone-50"
                      style={{ fontVariationSettings: '"opsz" 64' }}
                    >
                      {consumedCount}
                    </span>
                    <span className="text-[14px] text-stone-400">
                      of {totalItems} {totalItems === 1 ? 'title' : 'titles'} finished
                    </span>
                  </p>

                  <div className="mt-3.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
                    {STATUS_STEPS.map((step) => {
                      const count = statusCounts[step.key] ?? 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={step.key}
                          className={cn(
                            'h-full first:rounded-l-full last:rounded-r-full',
                            step.className,
                          )}
                          style={{ width: `${(count / statusTotal) * 100}%` }}
                        />
                      );
                    })}
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {STATUS_STEPS.filter(
                      // An opt-out count of zero is not a fourth state, it is
                      // the absence of one.
                      (step) => step.key !== 'not_interested' || (statusCounts[step.key] ?? 0) > 0,
                    ).map((step) => (
                      <li key={step.key} className="flex items-center gap-1.5 text-[12.5px]">
                        <span aria-hidden className={cn('h-2 w-2 rounded-[3px]', step.className)} />
                        <span className="text-stone-400">{step.label}</span>
                        <span className="font-semibold tabular-nums text-stone-200">
                          {statusCounts[step.key] ?? 0}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 border-t border-white/[0.07] pt-3 text-[12.5px] text-stone-500">
                    Across {groups.length} {groups.length === 1 ? 'group' : 'groups'}
                    <span aria-hidden className="px-1.5 text-stone-700">
                      ·
                    </span>
                    {addedCount} added by you
                  </p>
                </>
              )}
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Collection"
              caption="Every title across your groups, by kind."
            >
              {typeData.length === 0 ? (
                <p className="text-[13px] text-stone-500">Nothing collected yet.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="relative h-[132px] w-[132px] shrink-0">
                    <TypeRing slices={typeData} total={totalItems} />
                    <span className="pointer-events-none absolute inset-0 grid place-items-center text-[20px] font-semibold tracking-[-0.03em] text-stone-50">
                      {totalItems}
                    </span>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5">
                    {TYPES.map((type) => {
                      const Icon = TYPE_ICONS[type];
                      return (
                        <li key={type} className="flex items-center gap-2 text-[12.5px]">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                            style={{ background: `var(--chart-${type})` }}
                          />
                          <Icon className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                          <span className="truncate text-stone-400">{getTypePluralLabel(type)}</span>
                          <span className="ml-auto font-semibold tabular-nums text-stone-200">
                            {typeCounts[type] ?? 0}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Panel>
          </section>

          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-stone-100">
              Recently added
            </h2>
            {recentItems.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] bg-stone-900 p-8 text-center border border-white/[0.07]">
                <p className="text-[13.5px] text-stone-500">
                  Nothing added yet. Open a group and put the first title in.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
                {recentItems.map((item) => (
                  <li key={item.id}>
                    {/* No lift. A grid of covers that each hop when the
                        pointer crosses them is a field of twitching tiles;
                        what you want is the one you are looking at to warm up
                        and lean in slightly, and nothing else to move. */}
                    <Link href={`/groups/${item.groupId}`} className="group block">
                      <MediaPoster
                        src={item.imageUrl}
                        type={item.type}
                        size="xl"
                        zoomOnHover="subtle"
                      />
                      <div className="mt-2 space-y-0.5">
                        <p className="truncate text-[12.5px] font-semibold leading-snug tracking-[-0.015em] text-stone-100 transition-colors duration-[var(--duration-drift)] ease-[var(--ease-drift)] group-hover:text-amber-300">
                          {item.title}
                        </p>
                        <p className="truncate text-[11.5px] leading-snug text-stone-500">
                          {item.groupName} · {formatDay(item.createdAt)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * One group, wearing its own shelf. The covers are cropped into a band rather
 * than shown as posters: at this size they are a texture that says "this is
 * the horror group" faster than the name does.
 */
function GroupCard({ group }: { group: GroupRow }) {
  const covers = group.covers.map(safeImageUrl).filter(Boolean) as string[];
  const total = TYPES.reduce((sum, type) => sum + (group.typeCounts[type] ?? 0), 0);

  return (
    // The lift is stepped, not eased, and that is deliberate. Travelling 2px on
    // a curve means passing through fractional pixel positions, and on a
    // fractional position the card's top edge has to antialias: measured on a
    // 2x screen, a crisp two-row border became a four-row smear running
    // 44-82-127 between the near-black page and the bright band. That dark
    // smear IS the gap, and it appears only while the card is in motion, which
    // is why it was never there at either end of the hover.
    //
    // steps(2, end) puts the card at 0px, -1px, -2px and nowhere in between.
    // Whole CSS pixels are whole device pixels at 1x and 2x alike, so every
    // frame draws the same crisp edge as the resting states. Over 2px of
    // travel there is no stepping to see — there was never enough distance for
    // the easing to be legible in the first place.
    <Link
      href={`/groups/${group.id}`}
      className="group block h-full translate-y-0 transform-gpu transition-[translate] duration-[var(--duration-standard)] ease-[steps(2,end)] hover:-translate-y-0.5"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-stone-900 border border-white/[0.07] transition-colors duration-[var(--duration-standard)] ease-[var(--ease-standard)] group-hover:border-white/25">
        {/* stone-900, matching the card, wherever there are covers: the strip
            scaling inside this clip can expose a sliver of the surface behind
            it mid-transition, and a sliver the same colour as the card is not
            a sliver. The lighter stone-800 is only wanted as the empty state. */}
        <div
          className={cn(
            'relative h-[78px] overflow-hidden',
            covers.length > 0 ? 'bg-stone-900' : 'bg-stone-800',
          )}
        >
          {covers.length > 0 ? (
            // The band is a collage, not five pictures: the transform lives on
            // the strip so the whole thing pushes in together. Scaling each
            // image separately made five little zooms with the seams between
            // them sliding about, which reads as five things, not one shelf.
            //
            // And it drifts rather than zooms — 3% more, on a curve with no
            // snap in it. A shelf of covers leaning in is atmosphere; a shelf
            // of covers jumping is a button.
            //
            // It also rests ABOVE 1. A strip scaled to exactly fill its band
            // lands its bottom edge on a fractional pixel while it animates,
            // and the surface behind shows through as a hairline along the
            // bottom. Resting at 1.04 keeps the collage permanently larger
            // than the window it is seen through, so there is no edge to
            // catch.
            <div className="flex h-full scale-[1.04] transform-gpu opacity-80 transition-[opacity,scale] duration-[var(--duration-drift)] ease-[var(--ease-drift)] group-hover:scale-[1.06] group-hover:opacity-100">
              {covers.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="h-full min-w-0 flex-1 object-cover"
                />
              ))}
            </div>
          ) : null}
          {/* -inset-px, not inset-0: the overlay is clipped by the band anyway,
              so letting it hang a pixel past every edge means there is no seam
              of its own to land on a fractional pixel while the card moves. */}
          <span className="pointer-events-none absolute -inset-px bg-gradient-to-t from-stone-900 via-stone-900/45 to-stone-900/10" />
          <span className="absolute right-2 top-2">
            {group.visibility === 'public' ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-stone-950/75 px-1.5 py-0.5 text-[11px] font-medium text-stone-300">
                <Globe className="h-2.5 w-2.5" /> Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-stone-950/75 px-1.5 py-0.5 text-[11px] font-medium text-stone-400">
                <Lock className="h-2.5 w-2.5" /> Private
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-stone-50 transition-colors group-hover:text-amber-300">
            {group.name}
          </h3>
          {group.description ? (
            <p className="line-clamp-2 text-[12.5px] leading-snug text-stone-500">
              {group.description}
            </p>
          ) : null}

          {total > 0 ? (
            <div
              className="mt-auto flex h-[4px] gap-[2px]"
              title={TYPES.filter((type) => group.typeCounts[type] > 0)
                .map((type) => `${group.typeCounts[type]} ${getTypePluralLabel(type).toLowerCase()}`)
                .join(', ')}
            >
              {TYPES.map((type) => {
                const count = group.typeCounts[type] ?? 0;
                if (count === 0) return null;
                return (
                  <span
                    key={type}
                    className="h-full rounded-full"
                    style={{ width: `${(count / total) * 100}%`, background: `var(--chart-${type})` }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="mt-auto" />
          )}

          <div className="flex items-center gap-3 pt-1 text-[12px] text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {group.memberCount}
            </span>
            <span>
              {group.itemCount} {group.itemCount === 1 ? 'title' : 'titles'}
            </span>
            {group.role === 'owner' ? (
              <span className="ml-auto text-[11.5px] text-amber-400/80">Owner</span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}

/**
 * The same card as a group you are in, with the two things it cannot know
 * taken out and one thing it can put in their place.
 *
 * The chrome is copied rather than shared: a joined card is a Link wrapping an
 * article, and this one cannot be, because the Cancel button has to sit inside
 * it and a button inside an anchor is not a thing a browser will parse. So the
 * article is the hover target and the link is stretched across it underneath,
 * with the button lifted above — same lift, same border warm-up, same shape in
 * the grid, valid markup.
 */
function PendingGroupCard({ group }: { group: PendingGroup }) {
  return (
    // Same two layers as a joined card, for the same reason the comment up
    // there gives: the lift is stepped so the card's top edge only ever lands
    // on whole pixels, and the border warms up on its own curve.
    <div className="group relative h-full translate-y-0 transform-gpu transition-[translate] duration-[var(--duration-standard)] ease-[steps(2,end)] hover:-translate-y-0.5">
      <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-stone-900 border border-white/[0.07] transition-colors duration-[var(--duration-standard)] ease-[var(--ease-standard)] group-hover:border-white/25">
        {/* The band a joined card fills with covers. There are none to show —
            that is the whole point of the state — so it holds the lock instead,
            at the size the artwork would have been. */}
        <div className="relative grid h-[78px] place-items-center bg-stone-800">
          <span className="pointer-events-none absolute -inset-px bg-gradient-to-t from-stone-900 via-stone-900/45 to-stone-900/10" />
          {/* After the wash, not under it: a joined card's covers are meant to
              sit behind that gradient, but the lock IS this card's picture. */}
          <Lock className="relative h-5 w-5 text-stone-600" aria-hidden />
          {/* The badge in a joined card's top-right corner is the first thing
              read on it, so on this card that corner says the thing you came
              back to check. Visibility keeps the other corner: still there,
              no longer the headline. */}
          <span className="absolute right-2 top-2">
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
              <Clock className="h-2.5 w-2.5" /> Waiting for approval
            </span>
          </span>
          <span className="absolute left-2 top-2">
            {group.visibility === 'public' ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-stone-950/75 px-1.5 py-0.5 text-[11px] font-medium text-stone-300">
                <Globe className="h-2.5 w-2.5" /> Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-stone-950/75 px-1.5 py-0.5 text-[11px] font-medium text-stone-400">
                <Lock className="h-2.5 w-2.5" /> Private
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
          {/* Stretched: the whole card is the target, the same as a joined one,
              without nesting anything interactive inside an anchor. */}
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-stone-50 transition-colors group-hover:text-amber-300">
            <Link href={`/groups/${group.id}`} className="before:absolute before:inset-0">
              {group.name}
            </Link>
          </h3>
          {group.description ? (
            <p className="line-clamp-2 text-[12.5px] leading-snug text-stone-500">
              {group.description}
            </p>
          ) : null}

          {/* Row for row with a joined card from here down, so the two come
              out the same height and a row of the grid does not grow a step
              taller wherever a request happens to land in it. The type bar's
              slot stays empty — there is nothing to break down yet — and the
              stats line becomes the line that says what is going on. The
              slot still reserves the bar's 4px, so the card measures the same
              as a joined one even when it is alone in its row. */}
          <div className="mt-auto h-[4px]" />

          <div className="flex items-center gap-3 pt-1 text-[12px] text-stone-500">
            <span className="min-w-0 truncate">
              Request sent {formatDay(group.requestedAt)}
            </span>
            {/* Above the stretched link, or the click lands on the card. The
                negative margin gives the button a bigger hit area than its
                text without making the row taller than the joined card's. */}
            <form
              action={cancelGroupAccessRequest.bind(null, group.id)}
              className="relative ml-auto shrink-0"
            >
              <CancelRequestButton />
            </form>
          </div>
        </div>
      </article>
    </div>
  );
}

/** Sized like the "Owner" label it sits opposite, not like a Button: a
 *  control with a button's padding in this row would make the pending card
 *  taller than every card beside it. */
function CancelRequestButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="-m-1 rounded-[var(--radius-sm)] p-1 text-[11.5px] font-medium text-stone-400 transition-colors duration-[var(--duration-standard)] hover:text-red-300 disabled:text-stone-600"
    >
      {pending ? 'Cancelling...' : 'Cancel request'}
    </button>
  );
}

/**
 * The composition ring. Four slices and no interaction: the list beside it
 * already spells out every kind and its count, so a charting library here would
 * be a hundred kilobytes spent on a circle. The 2px gaps are cut out of the
 * dash pattern rather than drawn, so the surface shows through cleanly.
 */
function TypeRing({ slices, total }: { slices: { type: MediaType; count: number }[]; total: number }) {
  const RADIUS = 46;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const GAP = slices.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" role="img" aria-hidden>
      <circle cx="66" cy="66" r={RADIUS} fill="none" stroke="var(--chart-grid)" strokeWidth="14" />
      {slices.map((slice) => {
        const length = total > 0 ? (slice.count / total) * CIRCUMFERENCE : 0;
        const dash = Math.max(0, length - GAP);
        const node = (
          <circle
            key={slice.type}
            cx="66"
            cy="66"
            r={RADIUS}
            fill="none"
            stroke={`var(--chart-${slice.type})`}
            strokeWidth="14"
            strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += length;
        return node;
      })}
    </svg>
  );
}

function Panel({
  title,
  caption,
  className,
  children,
}: {
  title: string;
  caption: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-lg)] bg-stone-900 p-4 border border-white/[0.07]',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-stone-100">{title}</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] leading-snug text-stone-500">{caption}</p>
      {children}
    </section>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="rounded-[var(--radius-lg)] bg-stone-900 px-8 py-20 text-center border border-white/[0.07]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
    >
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-stone-100">
        No archives yet
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-stone-500">
        An archive is a shelf you and your friends keep together. Start one, or look at what other
        people are keeping.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/groups/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Create a group
          </Button>
        </Link>
        <Link href="/discover">
          <Button variant="secondary" size="sm" className="gap-2">
            <Compass className="h-3.5 w-3.5" />
            Discover
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
