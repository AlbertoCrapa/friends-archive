'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/layout/Wordmark';
import {
  Film,
  Tv,
  BookOpen,
  Gamepad2,
  Check,
} from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: EASE },
  },
};

function staggerContainer(delay = 0) {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: 0.09, delayChildren: delay } },
  };
}

function useScrollReveal() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref as React.RefObject<Element>, { once: true });
  return { ref, isInView };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  isSignedIn: boolean;
  nickname: string | null;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function LandingPageContent({ isSignedIn, nickname }: Props) {
  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
      <LandingNav isSignedIn={isSignedIn} nickname={nickname} />
      <HeroSection isSignedIn={isSignedIn} />
      <MediaTypesStrip />
      <HowItWorksSection />
      <SharedCatalogueSection />
      <PersonalTrackingSection />
      <MediaCategoriesSection />
      <OpenSourceSection />
      <FinalCtaSection isSignedIn={isSignedIn} />
      <LandingFooter />
    </main>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav({ isSignedIn, nickname }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-800/50 bg-stone-950/96 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Wordmark className="select-none" />
        <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isSignedIn ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              {nickname && (
                <Link href={`/profile/${nickname}`}>
                  <Button size="sm">My profile</Button>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HERO_LEDGER = [
  { n: '001', title: 'Dune: Part Two', type: 'Movie', status: 'Watched', statusColor: '#4ade80' },
  { n: '002', title: 'The Bear', type: 'TV', status: 'Watching', statusColor: '#f5b400' },
  { n: '003', title: 'Project Hail Mary', type: 'Book', status: 'Reading', statusColor: '#f5b400' },
  { n: '004', title: 'Elden Ring', type: 'Game', status: 'Planned', statusColor: '#52525b' },
  { n: '005', title: 'Past Lives', type: 'Movie', status: 'Planned', statusColor: '#52525b' },
] as const;

function HeroSection({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="relative min-h-[calc(100svh-73px)] flex flex-col">
      {/* Ambient glow — soft radial wash, fluid so it never forces overflow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        <div
          className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 'min(760px, 110vw)',
            height: 'min(420px, 60vh)',
            background:
              'radial-gradient(ellipse at center, #a87a000e 0%, transparent 70%)',
          }}
        />
      </div>

      <div
        className="relative flex-1 w-full max-w-6xl mx-auto px-6 grid items-center gap-x-16 gap-y-12 lg:grid-cols-[7fr_5fr]"
        style={{
          paddingTop: 'clamp(3rem, 7vh, 5rem)',
          paddingBottom: 'clamp(3rem, 7vh, 5rem)',
        }}
      >
        {/* Copy */}
        <motion.div
          className="space-y-7"
          variants={staggerContainer(0.1)}
          initial="hidden"
          animate="visible"
        >
          {/* A label, set as a label: small, wide, spaced, upright — the exact
              opposite of the headline under it, which is the only reason the
              two read as different ranks rather than as two sizes of the same
              thing. The box it used to sit in was doing that job badly. */}
          <motion.p className="type-label flex items-center gap-2.5 text-amber-600" variants={fadeUp}>
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rotate-45"
              style={{ backgroundColor: 'var(--color-accent)' }}
            />
            Track together, remember always
          </motion.p>

          {/*
            The same contrast the wordmark is built on, at display size: the
            first line narrow and set tight, the second wide open and drawn
            with a hairline. The gold is the smaller half of the idea — take it
            away and the line still has a shape. Before, colour was the ONLY
            thing separating the two halves and both were the text cut of the
            face blown up to 96px, which is what a headline looks like when it
            has been sized and not set.
          */}
          <motion.h1 className="type-display text-stone-50" variants={fadeUp}>
            <span className="block" style={{ fontSize: 'clamp(2.75rem, 6vw + 0.5rem, 5.5rem)' }}>
              The Friend
            </span>
            <span
              className="type-display-open block"
              style={{
                fontSize: 'clamp(2.75rem, 6vw + 0.5rem, 5.5rem)',
                color: 'var(--color-accent)',
              }}
            >
              Archive
            </span>
          </motion.h1>

          {/* Not `font-light`. Pale type on near-black blooms — the strokes
              optically fatten and then wash out — so a weight that reads as
              elegant on white reads as faded here. Body copy on these surfaces
              starts at 400. */}
          <motion.p
            className="max-w-lg leading-[1.6] text-stone-400"
            style={{ fontSize: 'clamp(1rem, 0.4vw + 0.92rem, 1.125rem)' }}
            variants={fadeUp}
          >
            A shared catalogue for everything worth experiencing together.
            Movies, TV series, books, and games: organised, remembered,
            and enjoyed with the people who matter.
          </motion.p>

          <motion.div className="flex items-center gap-4 flex-wrap" variants={fadeUp}>
            {isSignedIn ? (
              <>
                <Link href="/dashboard">
                  <Button size="lg">Open dashboard</Button>
                </Link>
                <Link href="/discover">
                  <Button variant="outline" size="lg">Discover groups</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg">Create your archive</Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" size="lg">Sign in</Button>
                </Link>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Catalogue card */}
        <motion.div
          className="relative w-full max-w-md mx-auto lg:max-w-none"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
        >
          <div
            className="border lg:rotate-1 lg:hover:rotate-0 transition-transform duration-500"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-2)',
            }}
          >
            <div className="border-b px-5 py-3.5 flex items-baseline justify-between gap-3" style={{ borderColor: 'var(--color-border)' }}>
              <span className="truncate text-[1.125rem] font-medium tracking-[-0.02em] text-stone-100">Friday Night Crew</span>
              <span
                className="font-mono text-[10px] whitespace-nowrap"
                style={{ color: '#52525b' }}
              >
                Catalogue Nº 027
              </span>
            </div>
            <ul>
              {HERO_LEDGER.map((row) => (
                <li
                  key={row.n}
                  className="px-5 py-3 flex items-center gap-4 border-b last:border-b-0"
                  style={{ borderColor: '#27272a8c' }}
                >
                  <span
                    className="font-mono text-[10px] shrink-0"
                    style={{ color: '#52525b' }}
                  >
                    {row.n}
                  </span>
                  <span className="text-sm text-stone-200 font-light truncate flex-1">
                    {row.title}
                  </span>
                  <span
                    className="font-mono text-[10px] hidden sm:block shrink-0"
                    style={{ color: '#52525b' }}
                  >
                    {row.type}
                  </span>
                  <span
                    className="font-mono text-[10px] shrink-0"
                    style={{ color: row.statusColor }}
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span
                className="font-mono text-[10px] "
                style={{ color: '#52525b' }}
              >
                6 friends · 14 titles · est. 2024
              </span>
            </div>
          </div>

          {/* Rubber-stamp mark */}
          <motion.div
            className="absolute -top-3 -right-2 sm:-right-4 rotate-6 border-2 px-3 py-1 select-none"
            style={{
              borderColor: '#7a59008c',
              backgroundColor: 'var(--color-background)',
            }}
            initial={{ opacity: 0, scale: 1.4, rotate: 6 }}
            animate={{ opacity: 1, scale: 1, rotate: 6 }}
            transition={{ duration: 0.35, ease: EASE, delay: 1.15 }}
            aria-hidden
          >
            <span
              className="font-mono text-[10px] "
              style={{ color: '#a87a00cc' }}
            >
              Archived
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Media types strip ────────────────────────────────────────────────────────

function MediaTypesStrip() {
  const { ref, isInView } = useScrollReveal();
  const types = ['Movies', 'TV Series', 'Books', 'Video Games'];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="border-t border-stone-800/50 py-9"
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-center gap-x-5 gap-y-3 sm:gap-x-8 flex-wrap">
        {types.map((type, i) => (
          <motion.span
            key={type}
            className="flex items-center gap-x-5 sm:gap-x-8 font-mono text-xs"
            style={{ color: '#52525b' }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: i * 0.09, duration: 0.55 }}
          >
            {i > 0 && (
              <span
                className="w-1 h-1 rotate-45 shrink-0"
                style={{ backgroundColor: '#7a590080' }}
                aria-hidden
              />
            )}
            {type}
          </motion.span>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const { ref, isInView } = useScrollReveal();

  const steps = [
    {
      number: '01',
      title: 'Create a group',
      body: 'Start an archive for your crew: friends, a partner, your family. Each group has its own curated catalogue.',
    },
    {
      number: '02',
      title: 'Add what you want to experience',
      body: 'Movies, TV shows, books, games. Add a title, set the type, and include metadata like director or year.',
    },
    {
      number: '03',
      title: 'Track and remember together',
      body: "Mark your progress. Leave personal notes only you can see. Check who else has watched, read, or played.",
    },
  ];

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="border-t border-stone-800/50 py-16 sm:py-24 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="space-y-14"
        >
          <div className="space-y-5">
            <motion.p variants={fadeUp} className="type-label text-amber-600">
              How it works
            </motion.p>
            {/*
              Two sentences, so two lines — it used to wrap mid-sentence, which
              broke the one thing the line has going for it. And the difference
              between them is weight and width rather than a single word picked
              out in gold: the same pairing as the wordmark and the hero, so by
              the third time you meet it you know it is the voice of the place.
            */}
            <motion.h2 variants={fadeUp} className="type-head max-w-xl text-[2.25rem] text-stone-50 sm:text-[3.25rem]">
              <span className="block">Simple by design.</span>
              <span className="type-head-open block" style={{ color: 'var(--color-accent)' }}>
                Shared by nature.
              </span>
            </motion.h2>
          </div>

          <ol className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
            {steps.map((step) => (
              <motion.li key={step.number} variants={fadeUp} className="relative border-t border-white/[0.09] pt-5">
                {/*
                  The index was set at 77px in a grey one shade off the
                  background: the biggest thing in the section was the least
                  meaningful thing in it, and it pushed the sentence people
                  actually came to read a hundred pixels down the page. It is a
                  marker, so it is now marked — same label setting as every
                  other small piece of furniture on the page, sitting on the
                  rule it belongs to.
                */}
                <span
                  aria-hidden
                  className="absolute -top-px left-0 h-px w-10"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                />
                <span className="type-label block tracking-[0.1em] text-amber-600">{step.number}</span>
                <h3 className="mt-3.5 text-[1.3125rem] font-medium leading-snug tracking-[-0.02em] text-stone-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-[0.9375rem] leading-[1.6] text-stone-400">{step.body}</p>
              </motion.li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Shared catalogue feature section ────────────────────────────────────────

function SharedCatalogueSection() {
  const { ref, isInView } = useScrollReveal();

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="border-t border-stone-800/50 py-16 sm:py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        {/* Text */}
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="space-y-6"
        >
          <motion.p
            variants={fadeUp}
            className="type-label text-amber-600"
          >
            Shared catalogues
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="type-head text-[2.25rem] text-stone-50 sm:text-[3.25rem]"
          >
            One place for everything your group wants to experience
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[1.0625rem] leading-[1.6] text-stone-400">
            No more scattered chat threads. Your archive keeps every title, every recommendation,
            every plan in one shared catalogue, visible to the whole group.
          </motion.p>
          <motion.ul variants={staggerContainer(0.1)} className="space-y-3 pt-2">
            {[
              'Multiple groups for different circles',
              'Movies, TV, books, and games in one list',
              'See who added what and when',
              'Public groups anyone can browse and join',
            ].map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-start gap-3 text-sm text-stone-400"
              >
                <Check
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: 'var(--color-accent)' }}
                />
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* UI mock */}
        <motion.div
          className="border border-stone-800/60 overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-2)' }}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: EASE, delay: 0.22 }}
        >
          <div className="border-b border-stone-800/60 px-5 py-3.5 flex items-center justify-between">
            <span className="text-[1.125rem] font-medium tracking-[-0.02em] text-stone-100">Cinema Crew</span>
            <span className="font-mono text-[10px]" style={{ color: '#52525b' }}>
              6 members
            </span>
          </div>
          <div className="border-b border-stone-800/60 px-5 py-2.5 flex gap-5 overflow-x-auto">
            {['All (14)', 'Movies (9)', 'TV (3)', 'Books (2)'].map((tab, i) => (
              <span
                key={tab}
                className="font-mono text-[10px] whitespace-nowrap"
                style={
                  i === 0
                    ? {
                        color: 'var(--color-accent)',
                        borderBottom: '1px solid var(--color-accent)',
                        paddingBottom: '4px',
                        marginBottom: '-10px',
                      }
                    : { color: '#52525b' }
                }
              >
                {tab}
              </span>
            ))}
          </div>
          {[
            { title: 'Dune: Part Two', type: 'Movie', status: 'Watched', statusColor: '#4ade80' },
            { title: 'The Bear', type: 'TV', status: 'Watching', statusColor: '#f5b400' },
            { title: 'Interstellar', type: 'Movie', status: 'Plan to Watch', statusColor: '#52525b' },
            { title: 'Poor Things', type: 'Movie', status: 'Plan to Watch', statusColor: '#52525b' },
            { title: 'Station Eleven', type: 'TV', status: 'Watched', statusColor: '#4ade80' },
          ].map((row) => (
            <div
              key={row.title}
              className="px-5 py-3.5 border-b border-stone-800/30 flex items-center justify-between gap-4"
            >
              <span className="text-sm text-stone-200 font-light truncate">{row.title}</span>
              <div className="flex items-center gap-5 shrink-0">
                <span
                  className="font-mono text-[10px] hidden sm:block"
                  style={{ color: '#3f3f46' }}
                >
                  {row.type}
                </span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: row.statusColor }}
                >
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Personal tracking feature section ───────────────────────────────────────

function PersonalTrackingSection() {
  const { ref, isInView } = useScrollReveal();

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="border-t border-stone-800/50 py-16 sm:py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        {/* UI mock — left on desktop */}
        <motion.div
          className="border border-stone-800/60 order-2 lg:order-1 overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-2)' }}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: EASE, delay: 0.22 }}
        >
          <div className="border-b border-stone-800/60 px-5 py-3.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[1.125rem] font-medium tracking-[-0.02em] text-stone-100">Dune: Part Two</span>
            <span
              className="font-mono text-[10px] whitespace-nowrap"
              style={{ color: '#52525b' }}
            >
              Consumed by
            </span>
          </div>
          <div className="p-5 space-y-5">
            {[
              {
                name: 'marco_b',
                date: 'May 2024',
                note: 'Absolutely stunning. The visuals alone justify the IMAX ticket.',
                isYou: false,
              },
              {
                name: 'sara_v',
                date: 'Jun 2024',
                note: "Loved the world-building. Could not stop thinking about it for days.",
                isYou: false,
              },
              {
                name: 'you',
                date: 'Jul 2024',
                note: null,
                isYou: true,
              },
            ].map((user) => (
              <div key={user.name} className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="w-6 h-6 flex items-center justify-center border font-mono text-[10px] shrink-0 select-none"
                    style={{
                      borderColor: user.isYou ? '#4a360099' : 'var(--color-border)',
                      backgroundColor: 'var(--color-surface-elevated)',
                      color: user.isYou ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                    aria-hidden
                  >
                    {user.name.charAt(0)}
                  </span>
                  <span
                    className="font-mono text-xs"
                    style={{
                      color: user.isYou ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {user.name}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: '#52525b' }}>
                    {user.date}
                  </span>
                  {user.isYou && (
                    <span
                      className="font-mono text-[9px] px-1.5 py-0.5 border"
                      style={{
                        borderColor: '#4a3600',
                        color: '#a87a00',
                      }}
                    >
                      you
                    </span>
                  )}
                </div>
                {user.note ? (
                  <p
                    className="text-xs font-light leading-relaxed pl-9"
                    style={{ color: '#71717a' }}
                  >
                    "{user.note}"
                  </p>
                ) : (
                  <p
                    className="text-xs font-mono italic pl-9"
                    style={{ color: '#52525b' }}
                  >
                    No note added yet
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Text — right on desktop */}
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="space-y-6 order-1 lg:order-2"
        >
          <motion.p
            variants={fadeUp}
            className="type-label text-amber-600"
          >
            Personal tracking
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="type-head text-[2.25rem] text-stone-50 sm:text-[3.25rem]"
          >
            Your progress. Your notes. Your memory.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[1.0625rem] leading-[1.6] text-stone-400">
            Mark items as planned, in progress, or completed. Leave a personal note about what you
            thought: only you can see it. Check who in your group has consumed something, without
            spoiling it.
          </motion.p>
          <motion.ul variants={staggerContainer(0.1)} className="space-y-3 pt-2">
            {[
              'Personal notes visible only to you',
              'See who in the group has consumed an item',
              'Status syncs automatically with your consumption record',
              'Your history, preserved across all groups',
            ].map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-start gap-3 text-sm text-stone-400"
              >
                <Check
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: 'var(--color-accent)' }}
                />
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Media categories ─────────────────────────────────────────────────────────

const MEDIA_CATEGORIES = [
  {
    icon: Film,
    label: 'Movies',
    description:
      "Feature films with director, release year, and runtime. From classics to this weekend's release.",
  },
  {
    icon: Tv,
    label: 'TV Series',
    description:
      "Series tracking with season count and platform. Know who's bingeing ahead and who's still on episode one.",
  },
  {
    icon: BookOpen,
    label: 'Books',
    description:
      'Author, publisher, and publication year. Build a reading list you will actually finish together.',
  },
  {
    icon: Gamepad2,
    label: 'Video Games',
    description:
      "Developer, publisher, platform. Keep track of what is in the backlog before the next sale starts.",
  },
] as const;

function MediaCategoriesSection() {
  const { ref, isInView } = useScrollReveal();

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="border-t border-stone-800/50 py-16 sm:py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="space-y-16"
        >
          <div className="space-y-4">
            <motion.p
              variants={fadeUp}
              className="type-label text-amber-600"
            >
              Media types
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="type-head max-w-lg text-[2.25rem] text-stone-50 sm:text-[3.25rem]"
            >
              Everything your group loves, in one archive
            </motion.h2>
          </div>

          {/* Gap-fill grid — not identical cards */}
          <motion.div
            variants={staggerContainer(0.08)}
            className="grid grid-cols-1 sm:grid-cols-2 border border-stone-800/50"
          >
            {MEDIA_CATEGORIES.map(({ icon: Icon, label, description }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="group p-8 space-y-4 border-b border-r border-stone-800/40 last:border-b-0 even:border-r-0 sm:even:border-r sm:[&:nth-child(3)]:border-r-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(4)]:border-b-0 transition-colors duration-300 hover:bg-[var(--color-surface)]"
                style={{ backgroundColor: 'var(--color-background)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-11 h-11 flex items-center justify-center border shrink-0 transition-colors duration-300"
                    style={{
                      backgroundColor: 'var(--color-surface-elevated)',
                      borderColor: '#4a360059',
                    }}
                  >
                    <Icon className="h-[18px] w-[18px]" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <h3 className="text-[1.375rem] font-medium tracking-[-0.025em] text-stone-50">{label}</h3>
                </div>
                <p className="text-[0.9375rem] leading-[1.6] text-stone-400">{description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Open source notice ───────────────────────────────────────────────────────

function OpenSourceSection() {
  const { ref, isInView } = useScrollReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="border-t border-stone-800/50 py-16 sm:py-24 lg:py-32"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="space-y-6 text-center"
        >
          <motion.p
            variants={fadeUp}
            className="type-label text-amber-600"
          >
            Free &amp; open source
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="type-head text-[1.875rem] text-stone-50 sm:text-[2.5rem] lg:text-[3rem]"
          >
            Free forever. No catch.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto max-w-xl text-[1.0625rem] leading-[1.6] text-stone-400"
          >
            The Friend Archive is a free, open-source hobby project. There are no paid plans,
            no ads, and no commercial use intended. Just a place to keep track of what you and
            your friends want to experience together.
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="font-mono text-xs"
            style={{ color: '#52525b' }}
          >
            Built for fun, not for profit.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCtaSection({ isSignedIn }: { isSignedIn: boolean }) {
  const { ref, isInView } = useScrollReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="relative border-t border-stone-800/50 py-20 sm:py-32 lg:py-44 text-center px-6"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 'min(680px, 100%)',
            height: 'min(380px, 80%)',
            background:
              'radial-gradient(ellipse at center, #a87a000d 0%, transparent 70%)',
          }}
        />
      </div>
      <motion.div
        variants={staggerContainer()}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="relative max-w-2xl mx-auto space-y-8"
      >
        <motion.h2
          variants={fadeUp}
          className="type-display text-[2.5rem] text-stone-50 sm:text-[3.25rem] lg:text-[4rem]"
        >
          {/* Third and last appearance of the pairing: tight white, open gold.
              By now it should read as the way this product writes its own
              name, not as a decision taken again on each screen. */}
          <span className="block">Start archiving</span>
          <span className="type-display-open block" style={{ color: 'var(--color-accent)' }}>
            together.
          </span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mx-auto max-w-sm leading-[1.6] text-stone-400"
        >
          Free to start. No credit card required. Your first archive is ready in seconds.
        </motion.p>
        <motion.div variants={fadeUp} className="flex justify-center gap-4 flex-wrap">
          {isSignedIn ? (
            <Link href="/dashboard">
              <Button size="lg">Open dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/register">
                <Button size="lg">Create your archive</Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="lg">
                  Sign in
                </Button>
              </Link>
            </>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer
      className="border-t border-stone-800/50 py-8"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <Wordmark size="0.8125rem" className="opacity-60" />
          <span
            className="font-mono text-[10px]"
            style={{ color: '#3f3f46' }}
          >
            Free &amp; open source · no commercial use intended
          </span>
        </div>
        <div className="flex gap-6">
          {[
            { href: '/discover', label: 'Discover' },
            { href: '/register', label: 'Get started' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-mono text-xs transition-colors"
              style={{ color: '#52525b' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
