'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check, CloudOff, Link2, Lock, MessageSquare, MoreHorizontal, Plus, RefreshCw, Wifi } from 'lucide-react';
import { HideOnScrollHeader } from '@/components/layout/HideOnScrollHeader';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/layout/Wordmark';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { RubberSegment } from '@/components/micro/RubberSegment';
import { StatusMark } from '@/components/micro/StatusMark';
import { MediaPoster, TYPE_ICONS } from '@/components/features/media/MediaPoster';
import { StatusDot, statusOptions } from '@/components/features/media/StatusDot';
import { BENEFITS, InstallButton, InstallSteps, PLATFORM_LABEL, useInstall, type Platform } from '@/components/features/install/InstallApp';
import { METADATA_FIELDS } from '@/lib/groupArchive';
import { cn } from '@/lib/utils';
import { getStatusLabel, getStatusOptions, getTypeLabel } from '@/types';
import type { ItemStatus, MediaType } from '@/types';

// ============================================================================
// The homepage. Every moving part demonstrates a product mechanic (PRODUCT.md,
// "Motion explains"), and every mock is built from the archive's own pieces —
// RubberSegment, GlideSelect, StatusDot, StatusMark, MediaPoster, the row grid
// and the finished meter — so what a visitor learns here is what they meet in
// a group. Reduced motion gets the end state, static.
// ============================================================================

const EASE = [0.23, 1, 0.32, 1] as const;
const REPO = 'https://github.com/AlbertoCrapa/friends-archive';
const STATUS_OPTIONS = statusOptions(getStatusOptions());

const HUE: Record<MediaType, string> = {
  movie: 'var(--chart-movie)',
  tv_series: 'var(--chart-tv_series)',
  book: 'var(--chart-book)',
  video_game: 'var(--chart-video_game)',
};

const TYPE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies', icon: <TYPE_ICONS.movie className="h-4 w-4" /> },
  { value: 'tv_series', label: 'TV', icon: <TYPE_ICONS.tv_series className="h-4 w-4" /> },
  { value: 'book', label: 'Books', icon: <TYPE_ICONS.book className="h-4 w-4" /> },
  { value: 'video_game', label: 'Games', icon: <TYPE_ICONS.video_game className="h-4 w-4" /> },
];

/**
 * Artwork for the demo titles, fetched once from the same providers the app
 * uses (TMDB, Open Library, RAWG) and kept in public/landing/posters so the
 * page never waits on their CDNs. A title missing here falls back to the glyph.
 */
const POSTERS: Record<string, string> = {
  'Dune: Part Two': 'dune-part-two', 'Perfect Days': 'perfect-days', Anora: 'anora',
  'The Bear': 'the-bear', 'Shōgun': 'shogun',
  'Project Hail Mary': 'project-hail-mary', Piranesi: 'piranesi',
  'Elden Ring': 'elden-ring', 'Hades II': 'hades-ii', 'Split Fiction': 'split-fiction',
};
const posterOf = (title: string) => (POSTERS[title] ? `/landing/posters/${POSTERS[title]}.jpg` : null);

/** MediaPoster's frame around a local file (MediaPoster only takes provider URLs, by design). */
function Poster({ title, type, size, className }: { title: string; type: MediaType; size: 'sm' | 'md'; className?: string }) {
  const src = posterOf(title);
  if (!src) return <MediaPoster type={type} size={size} className={className} />;
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-white/[0.07] bg-stone-800', size === 'sm' ? 'h-14 w-[38px]' : 'h-[72px] w-12', className)}>
      <Image src={src} alt="" fill sizes="48px" className="scale-100 object-cover transition-[scale] duration-300 ease-out group-hover:scale-[1.06]" />
    </div>
  );
}

/** The demo group. "you" is always first, as in the app's roster. */
const ROSTER = ['you', 'marco', 'sara', 'luca', 'giulia'];
const OTHERS = ROSTER.slice(1);

interface Props {
  isSignedIn: boolean;
  nickname: string | null;
}

export function LandingPageContent({ isSignedIn, nickname }: Props) {
  return (
    <main className="min-h-screen overflow-x-clip">
      <LandingNav isSignedIn={isSignedIn} nickname={nickname} />
      <Hero isSignedIn={isSignedIn} />
      <ChatToCatalogue />
      <FeatureBento />
      <MediaTypes />
      <InstallSection />
      <Facts />
      <FinalCta isSignedIn={isSignedIn} />
      <LandingFooter />
    </main>
  );
}

// ─── Shared pieces ────────────────────────────────────────────────────────────

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** The index rail: a number on a hairline, then the two-weight head. */
function SectionHead({ n, strong, open, lead }: { n: string; strong: string; open: string; lead?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <div className="flex items-center gap-3 text-[13px] font-medium tabular-nums text-stone-400">
        <span style={{ color: 'var(--color-accent)' }}>{n}</span>
        <span aria-hidden className="h-px w-10 bg-stone-700" />
      </div>
      <h2 className="type-head mt-5 text-[2.25rem] text-stone-50 sm:text-[3.25rem]">
        <span className="block">{strong}</span>
        <span className="type-head-open block text-stone-400">{open}</span>
      </h2>
      {lead && <p className="mt-5 max-w-lg text-[1.0625rem] leading-[1.6] text-stone-400">{lead}</p>}
    </Reveal>
  );
}

/** The archive's finished meter: one bar per member, the viewer's taller, green once finished. */
function Meter({ finished }: { finished: string[] }) {
  const everyone = finished.length === ROSTER.length;
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-label={`${finished.length} of ${ROSTER.length} finished`}>
      <span aria-hidden className="flex items-end gap-[3px]">
        {ROSTER.map((m) => (
          <span
            key={m}
            className={cn(
              'w-[4px] rounded-full transition-[height,background-color] duration-300',
              finished.includes(m) ? 'bg-emerald-500' : 'bg-stone-600',
              m === 'you' ? 'h-[17px]' : 'h-[12px]',
            )}
          />
        ))}
      </span>
      <span className={cn('text-[11.5px] tabular-nums', everyone ? 'text-emerald-400' : 'text-stone-400')}>
        {everyone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : `${finished.length}/${ROSTER.length}`}
      </span>
    </div>
  );
}

interface RowData {
  title: string;
  type: MediaType;
  meta: string;
  tags?: string[];
  /** Other members who finished it; yours comes from `mine`. */
  others: string[];
  mine: ItemStatus;
}

/**
 * One archive row, as MediaTable draws it: poster spanning two rows on a
 * phone, title and meta, tags, then the band — meter, your status, comments,
 * menu. `dense` drops the tags and the band for the narrow story panes.
 */
function ArchiveRow({ row, onStatus, dense = false }: { row: RowData; onStatus?: (s: ItemStatus) => void; dense?: boolean }) {
  const Glyph = TYPE_ICONS[row.type];
  const finished = row.mine === 'completed' ? ['you', ...row.others] : row.others;
  const everyone = finished.length === ROSTER.length;

  return (
    <div
      className={cn(
        'group relative isolate grid items-start gap-x-3 gap-y-1.5 rounded-[12px] border p-2 transition-colors hover:border-white/20 sm:gap-y-2 sm:p-2.5',
        dense ? 'grid-cols-[38px_minmax(0,1fr)_auto] items-center' : 'grid-cols-[48px_minmax(0,1fr)] sm:grid-cols-[48px_minmax(0,1fr)_auto]',
        everyone ? 'border-emerald-500/40' : 'border-white/[0.07]',
        row.mine === 'not_interested' && 'opacity-55',
      )}
    >
      {/* PosterGlow: the row tinted by a blurred copy of its own artwork, gone before the text. */}
      {posterOf(row.title) && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[12px]"
          style={{ maskImage: 'linear-gradient(to right, black, transparent 44%)', WebkitMaskImage: 'linear-gradient(to right, black, transparent 44%)' }}
        >
          <Image src={posterOf(row.title)!} alt="" fill sizes="200px" className="scale-[1.6] object-cover opacity-[0.13] blur-2xl saturate-150" />
        </span>
      )}
      <Poster title={row.title} type={row.type} size={dense ? 'sm' : 'md'} className={dense ? undefined : 'row-span-2 self-start sm:row-span-1'} />

      <div className="min-w-0 space-y-0.5 sm:space-y-1 sm:py-0.5">
        <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.015em] text-stone-50">{row.title}</h3>
        <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-stone-400">
          <Glyph className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="sr-only">{getTypeLabel(row.type)}</span>
          <span className="truncate">{row.meta}</span>
        </p>
        {!dense && row.tags && (
          <div className="flex flex-wrap items-center gap-1">
            {row.tags.map((t, i) => (
              <span
                key={t}
                className={cn(
                  'inline-flex h-[18px] items-center rounded-[var(--radius-sm)] bg-stone-800/80 px-1.5 text-[11px] font-medium text-stone-400 sm:h-[20px]',
                  i >= 2 && 'hidden sm:inline-flex',
                )}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {dense ? (
        <span className="flex items-center gap-1.5 text-[12px] text-stone-400">
          <StatusDot status={row.mine} />
          {getStatusLabel(row.mine)}
        </span>
      ) : (
        <div className="flex min-h-8 items-center gap-1.5 sm:col-start-3 sm:row-start-1 sm:min-w-[240px] sm:justify-end sm:gap-2 sm:self-center">
          <span className="mr-auto">
            <Meter finished={finished} />
          </span>
          {onStatus ? (
            <GlideSelect
              ariaLabel={`Your status for ${row.title}`}
              align="right"
              value={row.mine}
              onChange={(v) => onStatus(v as ItemStatus)}
              label={<StatusDot status={row.mine} />}
              options={STATUS_OPTIONS}
            />
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] text-stone-400">
              <StatusDot status={row.mine} />
              {getStatusLabel(row.mine)}
            </span>
          )}
          {/* Comments and the row menu, drawn but inert: the demo has nowhere for them to go. */}
          <span aria-hidden className="grid h-8 w-8 place-items-center text-stone-400"><MessageSquare className="h-3.5 w-3.5" /></span>
          <span aria-hidden className="hidden h-8 w-8 place-items-center text-stone-400 sm:grid"><MoreHorizontal className="h-4 w-4" /></span>
        </div>
      )}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav({ isSignedIn, nickname }: Props) {
  return (
    <HideOnScrollHeader className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b0b0f]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="The Friend Archive, home">
          <Wordmark compact className="select-none" />
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] font-medium md:flex">
          <a href="#how" className="text-stone-400 hover:text-stone-50">How it works</a>
          <a href="#features" className="text-stone-400 hover:text-stone-50">Features</a>
          <a href="#install" className="text-stone-400 hover:text-stone-50">Install</a>
          <Link href="/discover" className="text-stone-400 hover:text-stone-50">Discover</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="text-stone-400 hover:text-stone-50">GitHub</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {isSignedIn ? (
            <>
              {nickname && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/profile/${nickname}`}>Profile</Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </HideOnScrollHeader>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

function Hero({ isSignedIn }: { isSignedIn: boolean }) {
  const reduce = useReducedMotion();
  const windowRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: windowRef, offset: ['start 0.95', 'start 0.2'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

  return (
    // Spacing and display size follow the viewport HEIGHT as well as its width, so
    // a 13" laptop (≈1440×800 inside the browser) gets the headline, the buttons
    // and the top of the live archive in the first screen, not just the words.
    <section className="relative" style={{ paddingTop: 'clamp(2.5rem, 7vh, 6rem)' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={reduce ? false : 'hidden'}
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <motion.a
            variants={fadeUp}
            href="#install"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-[12.5px] font-medium text-stone-300 hover:border-white/20 hover:text-stone-50"
          >
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>
              New
            </span>
            Install it as an app on any device
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </motion.a>

          <motion.h1
            variants={fadeUp}
            className="type-display text-stone-50"
            style={{ marginTop: 'clamp(1.25rem, 3.5vh, 1.75rem)', fontSize: 'clamp(2.75rem, min(7vw + 0.5rem, 9.5vh), 6rem)' }}
          >
            <span className="block">Your group chat</span>
            <span className="type-display-open block" style={{ color: 'var(--color-accent)' }}>
              forgets everything.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-xl leading-[1.6] text-stone-400"
            style={{ marginTop: 'clamp(1.25rem, 3.5vh, 1.75rem)', fontSize: 'clamp(1rem, 0.4vw + 0.92rem, 1.1875rem)' }}
          >
            The Friend Archive keeps one shared catalogue per group: movies, TV series,
            books and games, with each member&rsquo;s own status and private notes on top.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 'clamp(1.5rem, 4vh, 2.25rem)' }}>
            {isSignedIn ? (
              <>
                <Button asChild size="lg">
                  <Link href="/dashboard">Open dashboard <ArrowRight /></Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/discover">Discover groups</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/register">Start your archive <ArrowRight /></Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/discover">Browse public groups</Link>
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* The product, tilting flat as it scrolls into place. */}
        <div className="relative" style={{ perspective: 1400, marginTop: 'clamp(2.5rem, 6vh, 5rem)' }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[10%] -top-10 h-40 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(closest-side, rgba(44,153,248,0.16), transparent)' }}
          />
          <motion.div
            ref={windowRef}
            style={reduce ? undefined : { rotateX, scale, transformOrigin: '50% 0%' }}
            initial={reduce ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.35 }}
          >
            <LiveArchive />
          </motion.div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
        </div>
      </div>
    </section>
  );
}

interface LiveRow extends RowData {
  id: string;
}

const SEED: LiveRow[] = [
  { id: 'a', title: 'Dune: Part Two', type: 'movie', meta: '2024 · Denis Villeneuve · 2h 46m', tags: ['Sci-fi', 'IMAX'], others: OTHERS, mine: 'completed' },
  { id: 'b', title: 'The Bear', type: 'tv_series', meta: '2022 · Christopher Storer · 3 seasons', tags: ['Drama', 'Disney+'], others: ['sara', 'luca'], mine: 'consuming' },
  { id: 'c', title: 'Project Hail Mary', type: 'book', meta: '2021 · Andy Weir', tags: ['Sci-fi'], others: ['luca'], mine: 'plan_to_consume' },
  { id: 'd', title: 'Elden Ring', type: 'video_game', meta: '2022 · FromSoftware', tags: ['RPG', 'PS5', 'PC'], others: [], mine: 'plan_to_consume' },
];

const INCOMING: RowData[] = [
  { title: 'Shōgun', type: 'tv_series', meta: '2024 · Rachel Kondo · 1 season', tags: ['Drama', 'Disney+'], others: [], mine: 'plan_to_consume' },
  { title: 'Hades II', type: 'video_game', meta: '2025 · Supergiant Games', tags: ['Roguelike', 'PC'], others: [], mine: 'plan_to_consume' },
  { title: 'Piranesi', type: 'book', meta: '2020 · Susanna Clarke', tags: ['Fantasy'], others: [], mine: 'plan_to_consume' },
  { title: 'Perfect Days', type: 'movie', meta: '2023 · Wim Wenders · 2h 4m', tags: ['Drama'], others: [], mine: 'plan_to_consume' },
];

/** A group page that runs itself: titles arrive, members finish them, and the visitor can join in. */
function LiveArchive() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-10% 0px' });
  const [rows, setRows] = useState(SEED);
  const [fresh, setFresh] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const tick = useRef(0);

  const add = () => {
    const t = tick.current++;
    const row = { ...INCOMING[t % INCOMING.length], id: `n${t}` };
    setFresh(row.id);
    setRows((prev) => [row, ...prev].slice(0, 5));
  };

  useEffect(() => {
    if (reduce || !inView) return;
    let step = 0;
    const id = setInterval(() => {
      if (step++ % 3 === 0) return add();
      // Someone in the group finishes something; a row everyone finished starts over so the loop never stalls.
      setRows((prev) => {
        const i = prev.findIndex((r) => r.others.length < OTHERS.length);
        if (i === -1) return prev.map((r, j) => (j === prev.length - 1 ? { ...r, others: [] } : r));
        const next = OTHERS.find((m) => !prev[i].others.includes(m))!;
        return prev.map((r, j) => (j === i ? { ...r, others: [...r.others, next] } : r));
      });
    }, 2200);
    return () => clearInterval(id);
  }, [reduce, inView]);

  const shown = filter === 'all' ? rows : rows.filter((r) => r.type === filter);
  const setMine = (id: string, mine: ItemStatus) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, mine } : r)));

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-[#0b0b0f]"
      style={{ boxShadow: '0 40px 120px -40px rgba(0,0,0,0.9)' }}
    >
      {/* App bar, as the group page has it. */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        <Wordmark compact size="0.9375rem" />
        <span aria-hidden className="flex -space-x-1.5">
          {ROSTER.map((n) => (
            <span
              key={n}
              className={cn(
                'grid h-6 w-6 place-items-center rounded-full border-2 border-[#0b0b0f] text-[10px] font-semibold uppercase',
                n === 'you' ? 'bg-amber-500 text-[var(--color-on-accent)]' : 'bg-stone-800 text-stone-200',
              )}
            >
              {n[0]}
            </span>
          ))}
        </span>
      </div>

      <div className="px-4 pb-6 pt-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="page-title">Friday Night Crew</h3>
            <p className="mt-1.5 text-[13px] text-stone-400">5 members · {rows.length} titles · private</p>
          </div>
          <Button size="sm" onClick={add}>
            <Plus /> Add
          </Button>
        </div>

        <div className="archive-bar -mx-4 mt-5 border-y border-stone-800/70 px-4 py-2.5 sm:-mx-6 sm:px-6">
          <RubberSegment
            ariaLabel="Filter by kind"
            tight="sm"
            value={filter}
            onChange={setFilter}
            options={TYPE_TABS.map((o) => ({ ...o, count: o.value === 'all' ? rows.length : rows.filter((r) => r.type === o.value).length }))}
          />
        </div>

        <ul className="mt-4 flex min-h-[360px] flex-col gap-2 sm:min-h-[420px]">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="relative list-none"
              >
                {fresh === r.id && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[12px] ring-1 ring-amber-500/60"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 2.4 }}
                  />
                )}
                <ArchiveRow row={r} onStatus={(s) => setMine(r.id, s)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

// ─── 01 · From the chat to the catalogue (pinned scroll) ─────────────────────

const CHAT = [
  { from: 'sara', text: 'ok you HAVE to watch', title: 'Shōgun', after: ' this weekend', type: 'tv_series' as MediaType, meta: '2024 · Rachel Kondo' },
  { from: 'luca', text: 'finished', title: 'Piranesi', after: ' last night, no words', type: 'book' as MediaType, meta: '2020 · Susanna Clarke' },
  { from: 'marco', text: 'who’s up for', title: 'Split Fiction', after: '? need a co-op partner', type: 'video_game' as MediaType, meta: '2025 · Hazelight' },
  { from: 'you', text: 'saw', title: 'Anora', after: ', we should all go', type: 'movie' as MediaType, meta: '2024 · Sean Baker' },
];

function ChatToCatalogue() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  return (
    <section id="how" className="scroll-mt-20 pt-24 sm:pt-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          n="01"
          strong="Recommendations die in the chat."
          open="Here they get a shelf."
          lead="Every title somebody mentions becomes one entry in the group's catalogue, with who added it and who has already seen it."
        />
      </div>

      {/* ponytail: 260vh scroll track; shorten if the sequence feels slow. */}
      <div ref={ref} className={reduce ? '' : 'relative h-[260vh]'}>
        <div className={reduce ? 'py-16' : 'sticky top-0 flex h-svh items-center'}>
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2 md:gap-10">
            <Pane label="Group chat">
              <div className="flex flex-col gap-2.5">
                {CHAT.map((m, i) => <Bubble key={m.title} m={m} i={i} p={scrollYProgress} reduce={!!reduce} />)}
              </div>
            </Pane>
            <Pane label="Friday Night Crew">
              <ul className="flex flex-col gap-1.5">
                {CHAT.map((m, i) => <Shelved key={m.title} m={m} i={i} p={scrollYProgress} reduce={!!reduce} />)}
              </ul>
              <SavedCount p={scrollYProgress} reduce={!!reduce} />
            </Pane>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-white/[0.08] p-3 sm:p-5" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="mb-3 text-[13px] font-semibold tracking-[-0.01em] text-stone-200">{label}</div>
      {children}
    </div>
  );
}

type ChatMsg = (typeof CHAT)[number];

function Bubble({ m, i, p, reduce }: { m: ChatMsg; i: number; p: MotionValue<number>; reduce: boolean }) {
  const opacity = useTransform(p, [i * 0.09, i * 0.09 + 0.07], [0, 1]);
  const y = useTransform(p, [i * 0.09, i * 0.09 + 0.07], [16, 0]);
  // Once the title is shelved, the bubble fades back: the chat scrolls on, the entry stays.
  const fade = useTransform(p, [0.42 + i * 0.1, 0.5 + i * 0.1], [1, 0.4]);
  const mark = useTransform(p, [0.4 + i * 0.1, 0.46 + i * 0.1], [0, 1]);
  const you = m.from === 'you';

  return (
    <motion.div style={reduce ? undefined : { opacity, y }} className={cn('flex items-end gap-2', you && 'flex-row-reverse')}>
      <span
        aria-hidden
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold uppercase',
          you ? 'bg-amber-500 text-[var(--color-on-accent)]' : 'bg-stone-800 text-stone-200',
        )}
      >
        {m.from[0]}
      </span>
      <motion.div
        style={reduce ? { opacity: 0.4 } : { opacity: fade }}
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug',
          you ? 'rounded-br-md bg-stone-700 text-stone-50' : 'rounded-bl-md bg-stone-800 text-stone-200',
        )}
      >
        {m.text}{' '}
        <span className="relative font-semibold text-stone-50">
          {m.title}
          <motion.span
            aria-hidden
            className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full"
            style={{ backgroundColor: HUE[m.type], scaleX: reduce ? 1 : mark }}
          />
        </span>
        {m.after}
      </motion.div>
    </motion.div>
  );
}

function Shelved({ m, i, p, reduce }: { m: ChatMsg; i: number; p: MotionValue<number>; reduce: boolean }) {
  const range = [0.42 + i * 0.1, 0.5 + i * 0.1];
  const opacity = useTransform(p, range, [0, 1]);
  const x = useTransform(p, range, [-24, 0]);

  return (
    <motion.li style={reduce ? undefined : { opacity, x }} className="list-none">
      <ArchiveRow dense row={{ title: m.title, type: m.type, meta: `${m.meta} · added by ${m.from}`, others: [], mine: 'plan_to_consume' }} />
    </motion.li>
  );
}

function SavedCount({ p, reduce }: { p: MotionValue<number>; reduce: boolean }) {
  const [n, setN] = useState(reduce ? CHAT.length : 0);
  useEffect(() => {
    if (reduce) return;
    return p.on('change', (v) => setN(CHAT.filter((_, i) => v >= 0.46 + i * 0.1).length));
  }, [p, reduce]);

  return (
    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[13px]">
      <span className="text-stone-400">Mentioned in chat</span>
      <span className="tabular-nums font-medium text-stone-100">
        <span className="text-emerald-400">{n}</span> of {CHAT.length} kept
      </span>
    </div>
  );
}

// ─── 02 · Features (spotlight bento) ──────────────────────────────────────────

function FeatureBento() {
  return (
    <section id="features" className="scroll-mt-20 py-24 sm:py-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          n="02"
          strong="One shared list."
          open="A private layer on top."
          lead="The catalogue belongs to the group. Your status and your notes belong to you."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Spotlight className="md:col-span-4" delay={0}>
            <CardText title="Who has finished it, at a glance" body="Every member keeps their own status. Set yours." />
            <StatusDemo />
          </Spotlight>
          <Spotlight className="md:col-span-2" delay={0.06}>
            <CardText title="Notes only you can read" body="Write what you thought. Nobody else in the group sees it." />
            <NoteDemo />
          </Spotlight>
          <Spotlight className="md:col-span-3" delay={0.12}>
            <CardText title="Paste a link, get an entry" body="Drop a link and the title, year and credits are filled in for you." />
            <LinkDemo />
          </Spotlight>
          <Spotlight className="md:col-span-3" delay={0.18}>
            <CardText title="Works without a connection" body="Changes made offline wait in a queue and sync when you are back." />
            <OfflineDemo />
          </Spotlight>
        </div>
      </div>
    </section>
  );
}

/** A card with a soft accent light that follows the pointer. */
function Spotlight({ children, className = '', delay }: { children: ReactNode; className?: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - r.left}px`);
    el.style.setProperty('--y', `${e.clientY - r.top}px`);
  };

  return (
    <Reveal className={className} delay={delay}>
      <div
        ref={ref}
        onPointerMove={move}
        className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.08] p-6 sm:p-7"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'radial-gradient(420px circle at var(--x) var(--y), rgba(44,153,248,0.09), transparent 45%)' }}
        />
        <div className="relative flex h-full flex-col gap-6">{children}</div>
      </div>
    </Reveal>
  );
}

function CardText({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-[1.1875rem] font-semibold tracking-[-0.02em] text-stone-50">{title}</h3>
      <p className="mt-1.5 text-[0.9375rem] leading-[1.55] text-stone-400">{body}</p>
    </div>
  );
}

const ROOM: { name: string; status: ItemStatus; when?: string }[] = [
  { name: 'marco', status: 'completed', when: '3 days ago' },
  { name: 'sara', status: 'completed', when: 'last week' },
  { name: 'luca', status: 'consuming' },
  { name: 'giulia', status: 'not_interested' },
];

/** The item sheet's "who's where" list, with your own status live. */
function StatusDemo() {
  const [mine, setMine] = useState<ItemStatus>('plan_to_consume');
  const room = [{ name: 'you', status: mine, when: mine === 'completed' ? 'just now' : undefined }, ...ROOM];
  const done = room.filter((m) => m.status === 'completed').length;
  const going = room.filter((m) => m.status === 'consuming').length;
  const out = room.filter((m) => m.status === 'not_interested').length;

  return (
    <div className="mt-auto grid gap-4 rounded-[12px] border border-white/[0.07] bg-black/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Poster title="Dune: Part Two" type="movie" size="md" />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold tracking-[-0.015em] text-stone-50">Dune: Part Two</div>
            <div className="text-[12px] text-stone-400">2024 · Denis Villeneuve</div>
          </div>
        </div>
        <GlideSelect
          ariaLabel="Your status for Dune: Part Two"
          align="left"
          value={mine}
          onChange={(v) => setMine(v as ItemStatus)}
          label={<StatusDot status={mine} />}
          options={STATUS_OPTIONS}
        />
        <p className="text-[12.5px] text-stone-400">
          <span className="tabular-nums text-emerald-400">{done}</span> finished
          {going > 0 && <> · <span className="tabular-nums text-warn-400">{going}</span> in progress</>}
          {out > 0 && <> · <span className="tabular-nums">{out}</span> sitting it out</>}
        </p>
      </div>
      <ul className="space-y-0.5">
        {room.map((m) => (
          <li key={m.name} className={cn('flex items-center gap-2.5 rounded-[var(--radius-sm)] px-1.5 py-1.5', m.name === 'you' && 'bg-white/[0.04]')}>
            <StatusMark status={m.status} tone={m.name === 'you' ? 'you' : 'group'} size={18} />
            <span className={cn('min-w-0 flex-1 truncate text-[13px]', m.name === 'you' ? 'font-semibold text-stone-100' : 'text-stone-300')}>
              {m.name}
            </span>
            <span className="shrink-0 text-[11.5px] text-stone-400">{m.when ?? getStatusLabel(m.status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const NOTE = 'The sandworm scene in IMAX. Rewatch with Luca before part three.';

function NoteDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) return setN(NOTE.length);
    const id = setInterval(() => setN((v) => (v >= NOTE.length ? (clearInterval(id), v) : v + 1)), 38);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="mt-auto rounded-[12px] border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-stone-300">Your note</span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-stone-400">
          <Lock className="h-3 w-3" /> Only you
        </span>
      </div>
      <p className="mt-2.5 min-h-[4.5em] rounded-[var(--radius-md)] border border-stone-700 bg-stone-950/60 px-3 py-2 text-[13.5px] leading-[1.5] text-stone-200">
        {NOTE.slice(0, n)}
        {n < NOTE.length && <span aria-hidden className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-stone-200" />}
      </p>
    </div>
  );
}

function LinkDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-60px' });
  const [step, setStep] = useState(reduce ? 2 : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = setInterval(() => setStep((s) => (s + 1) % 3), 1600);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="mt-auto flex flex-col gap-2.5">
      <div className="flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] border border-stone-700 bg-stone-950/60 px-3">
        <Link2 className="h-4 w-4 shrink-0 text-stone-400" />
        <span className="truncate text-[13px] text-stone-200">letterboxd.com/film/perfect-days-2023</span>
        {step === 1 && <RefreshCw className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-stone-400" />}
      </div>
      <div className="relative h-[76px]">
        <AnimatePresence>
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="absolute inset-x-0 top-0"
            >
              <ArchiveRow dense row={{ title: 'Perfect Days', type: 'movie', meta: '2023 · Wim Wenders · 2h 4m', others: [], mine: 'plan_to_consume' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const QUEUED = [
  { text: 'The Bear → Completed', match: false },
  { text: 'Added “Piranesi”', match: true },
  { text: 'Note on Anora', match: false },
];

function OfflineDemo() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (online) {
      if (pending === 0) return;
      const id = setTimeout(() => setPending((n) => n - 1), 450);
      return () => clearTimeout(id);
    }
    if (pending >= QUEUED.length) return;
    const id = setTimeout(() => setPending((n) => n + 1), 600);
    return () => clearTimeout(id);
  }, [online, pending]);

  return (
    <div className="mt-auto rounded-[12px] border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('flex items-center gap-2 text-[13px] font-medium', online ? 'text-emerald-400' : 'text-warn-300')}>
          {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
          {online ? (pending ? 'Syncing…' : 'Synced') : `Offline · ${pending} queued`}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setOnline((o) => !o)}>
          {online ? 'Go offline' : 'Reconnect'}
        </Button>
      </div>
      <ul className="mt-3 min-h-[84px] space-y-1.5">
        <AnimatePresence initial={false}>
          {QUEUED.slice(0, pending).map((q) => (
            <motion.li
              key={q.text}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-[12.5px] text-stone-300"
            >
              <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-warn-400')} />
              {q.text}
              {q.match && !online && (
                <span className="rounded-[var(--radius-sm)] bg-warn-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-warn-300">Needs match</span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {pending === 0 && <li className="text-[12.5px] text-stone-400">Nothing waiting. Try going offline.</li>}
      </ul>
    </div>
  );
}

// ─── 03 · Four kinds of thing (photo columns) ────────────────────────────────

const FIELD_LABEL: Record<string, string> = {
  director: 'Director', release_year: 'Year', duration_minutes: 'Runtime', creator: 'Creator', seasons: 'Seasons',
  platform: 'Platform', author: 'Author', publication_year: 'Year', publisher: 'Publisher', developer: 'Developer', platforms: 'Platforms',
};

/**
 * Photos from Pexels (free for commercial use, no attribution required), saved
 * in public/landing so the page never depends on their CDN:
 *   movie       pexels.com/photo/8263323 — cottonbro studio
 *   tv_series   pexels.com/photo/9807281 — Ron Lach
 *   book        pexels.com/photo/4866041 — cottonbro studio
 *   video_game  pexels.com/photo/9068966 — Yan Krukau
 */
const KINDS: Record<MediaType, { label: string; photo: string; examples: string[] }> = {
  movie: { label: 'Movies', photo: '/landing/movie.jpg', examples: ['Dune: Part Two', 'Past Lives', 'Anora'] },
  tv_series: { label: 'TV Series', photo: '/landing/tv_series.jpg', examples: ['The Bear', 'Shōgun', 'Severance'] },
  book: { label: 'Books', photo: '/landing/book.jpg', examples: ['Piranesi', 'Project Hail Mary', 'Stoner'] },
  video_game: { label: 'Video Games', photo: '/landing/video_game.jpg', examples: ['Elden Ring', 'Hades II', 'Split Fiction'] },
};

function MediaTypes() {
  const [open, setOpen] = useState<MediaType>('movie');

  return (
    <section id="types" className="scroll-mt-20 pb-24 sm:pb-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          n="03"
          strong="Four kinds of thing."
          open="Each with its own details."
          lead="Every type keeps the fields that matter for it, and the colour it carries across the whole app."
        />
        <Reveal className="mt-14 flex flex-col gap-3 md:h-[460px] md:flex-row">
          {(Object.keys(KINDS) as MediaType[]).map((t) => {
            const active = open === t;
            const Glyph = TYPE_ICONS[t];
            return (
              <motion.button
                key={t}
                type="button"
                layout
                onClick={() => setOpen(t)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(t)}
                aria-expanded={active}
                transition={{ duration: 0.6, ease: EASE }}
                className={cn(
                  'group relative isolate flex flex-col overflow-hidden rounded-[var(--radius-lg)] border p-5 text-left transition-[border-color] sm:p-6',
                  active ? 'min-h-[340px] border-white/20' : 'min-h-[96px] border-white/10 hover:border-white/20',
                )}
                style={{ flex: active ? 3 : 1, backgroundColor: 'var(--color-surface)' }}
              >
                <Image
                  src={KINDS[t].photo}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className={cn(
                    '-z-20 scale-100 object-cover transition-[opacity,scale,filter] duration-[var(--duration-drift)] ease-[var(--ease-drift)]',
                    active ? 'opacity-100 group-hover:scale-[1.02]' : 'opacity-40 grayscale',
                  )}
                />
                {/* The grid card's scrim: solid under the words, gone by the middle. */}
                <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-stone-950 via-stone-950/70 via-35% to-transparent to-70%" />
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: HUE[t], opacity: active ? 1 : 0.5 }} />

                <span className="mt-auto flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-stone-950/70 ring-1 ring-white/10" style={{ color: HUE[t] }}>
                    <Glyph className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-[1.25rem] font-semibold tracking-[-0.025em] text-stone-50">{KINDS[t].label}</span>
                </span>
                <AnimatePresence>
                  {active && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.15, duration: 0.5, ease: EASE } }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className="mt-4 flex flex-col gap-4"
                    >
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(METADATA_FIELDS[t]).map((f) => (
                          <span key={f} className="inline-flex h-[22px] items-center rounded-[var(--radius-sm)] bg-stone-800/90 px-2 text-[11.5px] font-medium text-stone-200">
                            {FIELD_LABEL[f] ?? f}
                          </span>
                        ))}
                      </div>
                      <p className="text-[13.5px] text-stone-300">{KINDS[t].examples.join(' · ')}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

// ─── 04 · Install ─────────────────────────────────────────────────────────────

function InstallSection() {
  const { platform: detected } = useInstall();
  const [picked, setPicked] = useState<Platform | null>(null);
  const platform = picked ?? detected ?? 'chromium';

  return (
    <section id="install" className="scroll-mt-20 pb-24 sm:pb-36">
      {/* minmax(0,…) on a phone too: the device switcher scrolls inside its column instead of widening the page. */}
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div>
          <SectionHead
            n="04"
            strong="Install it like an app."
            open="No store, nothing to download."
            lead="The archive is a web app. Add it to your dock or home screen and it opens in its own window, instantly, even offline."
          />
          <Reveal className="mt-8" delay={0.1}>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <RubberSegment
                ariaLabel="Your device"
                value={platform}
                onChange={(v) => setPicked(v as Platform)}
                options={(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
              />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={platform} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}>
                <InstallSteps platform={platform} className="mt-5" />
              </motion.div>
            </AnimatePresence>
            <InstallButton size="lg" className="mt-7" />
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <InstallVisual />
        </Reveal>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl gap-x-8 gap-y-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 0.06} className="border-t border-white/[0.08] pt-5">
            <Icon className="h-5 w-5 text-amber-400" aria-hidden />
            <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.015em] text-stone-50">{title}</h3>
            <p className="mt-1 text-[14px] leading-[1.55] text-stone-400">{body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** A standalone app window and a phone home screen, the icon landing on it as you arrive. */
function InstallVisual() {
  const reduce = useReducedMotion();
  const appsBefore = ['#3f3f46', '#27272a', '#3f3f46', '#27272a', '#27272a', '#3f3f46', '#27272a'];

  return (
    <div className="relative pb-10 pr-6 sm:pr-16">
      {/* Desktop: no tabs, no address bar — the app's own window. */}
      <div className="overflow-hidden rounded-[12px] border border-white/10 bg-[#0b0b0f] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-stone-900 px-3 py-2">
          <span aria-hidden className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-stone-700" />)}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-4 w-4 rounded-[4px]" />
          <span className="text-[12px] font-medium text-stone-300">Archive</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-warn-500/15 px-2 py-0.5 text-[10.5px] font-medium text-warn-300">
            <CloudOff className="h-3 w-3" /> Offline copy
          </span>
        </div>
        <div className="space-y-2 p-3 sm:p-4">
          <div className="page-title !text-[1.375rem]">Friday Night Crew</div>
          <ArchiveRow dense row={{ title: 'Dune: Part Two', type: 'movie', meta: '2024 · Denis Villeneuve', others: OTHERS, mine: 'completed' }} />
          <ArchiveRow dense row={{ title: 'The Bear', type: 'tv_series', meta: '2022 · Christopher Storer', others: [], mine: 'consuming' }} />
          <ArchiveRow dense row={{ title: 'Piranesi', type: 'book', meta: '2020 · Susanna Clarke', others: [], mine: 'plan_to_consume' }} />
        </div>
      </div>

      {/* Phone: the icon arrives among the others. */}
      <div className="absolute -bottom-2 right-0 w-[150px] rounded-[28px] border border-white/15 bg-stone-950 p-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.95)] sm:w-[176px]">
        <div className="rounded-[21px] bg-gradient-to-b from-[#132238] to-[#0b0b0f] px-3 pb-6 pt-7">
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <div className="grid grid-cols-4 gap-2.5">
            {appsBefore.map((c, i) => <span key={i} aria-hidden className="aspect-square rounded-[8px]" style={{ backgroundColor: c }} />)}
            <motion.span
              className="relative flex flex-col items-center"
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', bounce: 0.5, duration: 0.7, delay: 0.6 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className="aspect-square w-full rounded-[8px] ring-2 ring-amber-400/70" />
            </motion.span>
          </div>
          <p className="mt-3 text-center text-[10.5px] font-medium text-stone-300">Archive added</p>
        </div>
      </div>
    </div>
  );
}

// ─── Facts ────────────────────────────────────────────────────────────────────

const FACTS = [
  { n: 4, suffix: '', label: 'media types in one list' },
  { n: 0, suffix: '', label: 'ads, trackers or paid tiers' },
  { n: 100, suffix: '%', label: 'open source on GitHub' },
  { n: 1, suffix: '', label: 'catalogue per group, shared' },
];

function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || !ref.current) return;
    if (reduce) return void (ref.current.textContent = `${to}${suffix}`);
    const c = animate(0, to, { duration: 1.4, ease: EASE, onUpdate: (v) => ref.current && (ref.current.textContent = `${Math.round(v)}${suffix}`) });
    return () => c.stop();
  }, [inView, reduce, to, suffix]);

  return <span ref={ref}>{`${to}${suffix}`}</span>;
}

function Facts() {
  return (
    <section className="border-y border-white/[0.06]" style={{ backgroundColor: 'rgba(24,24,27,0.5)' }}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
        {FACTS.map((f, i) => (
          <Reveal
            key={f.label}
            delay={i * 0.06}
            className={`py-10 sm:py-14 ${i % 2 ? 'pl-5 sm:pl-8' : ''} ${i > 1 ? 'border-t border-white/[0.06] md:border-t-0' : ''} ${i ? 'md:border-l md:border-white/[0.06] md:pl-8' : ''}`}
          >
            <div className="type-display text-[3rem] tabular-nums text-stone-50 sm:text-[4rem]">
              <CountUp to={f.n} suffix={f.suffix} />
            </div>
            <div className="mt-3 max-w-[14ch] text-[14px] leading-snug text-stone-400">{f.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta({ isSignedIn }: { isSignedIn: boolean }) {
  const reduce = useReducedMotion();
  const draw = (delay: number) => ({
    initial: reduce ? false : { pathLength: 0 },
    whileInView: { pathLength: 1 },
    viewport: { once: true },
    transition: { duration: 1.4, ease: EASE, delay },
  });

  return (
    <section className="relative overflow-hidden px-4 py-28 text-center sm:py-40">
      <div className="relative mx-auto flex max-w-2xl flex-col items-center">
        {/* The mark, drawn: two friends, one ring each. */}
        <svg viewBox="0 0 32 20" fill="none" strokeWidth={1.4} strokeLinecap="round" className="h-16 w-auto sm:h-20" aria-hidden>
          <motion.circle cx="11" cy="10" r="8" stroke="var(--color-text-primary)" {...draw(0)} />
          <motion.circle cx="21" cy="10" r="8" stroke="var(--color-accent)" {...draw(0.25)} />
        </svg>
        <Reveal>
          <h2 className="type-display mt-10 text-[2.75rem] text-stone-50 sm:text-[4.5rem]">
            <span className="block">Start the list</span>
            <span className="type-display-open block" style={{ color: 'var(--color-accent)' }}>you won&rsquo;t lose.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-sm leading-[1.6] text-stone-400">
            Free and open source. Make a group, invite your people, add the first title.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {isSignedIn ? (
              <Button asChild size="lg">
                <Link href="/dashboard">Open dashboard <ArrowRight /></Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/register">Create your archive <ArrowRight /></Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  const links = [
    { href: '/discover', label: 'Discover' },
    { href: '/register', label: 'Get started' },
    { href: '/login', label: 'Sign in' },
  ];
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Wordmark size="0.875rem" />
          <span className="text-[12.5px] text-stone-400">A free, open-source hobby project. No commercial use intended.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-stone-400 hover:text-stone-50">{l.label}</Link>
          ))}
          <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-50">
            GitHub <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
