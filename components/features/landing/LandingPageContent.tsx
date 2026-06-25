'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
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
      <PricingTeaserSection />
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
        <span className="font-serif text-base sm:text-xl tracking-[0.15em] sm:tracking-widest text-stone-100 uppercase select-none whitespace-nowrap">
          The Friend Archive
        </span>
        <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/pricing"
            className="hidden sm:block font-mono text-xs uppercase tracking-wider text-stone-500 hover:text-stone-300 transition-colors"
          >
            Pricing
          </Link>
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
  { n: '001', title: 'Dune: Part Two', type: 'Movie', status: 'Watched', statusColor: 'oklch(0.72 0.14 160)' },
  { n: '002', title: 'The Bear', type: 'TV', status: 'Watching', statusColor: 'oklch(0.78 0.13 62)' },
  { n: '003', title: 'Project Hail Mary', type: 'Book', status: 'Reading', statusColor: 'oklch(0.78 0.13 62)' },
  { n: '004', title: 'Elden Ring', type: 'Game', status: 'Planned', statusColor: 'oklch(0.42 0.005 60)' },
  { n: '005', title: 'Past Lives', type: 'Movie', status: 'Planned', statusColor: 'oklch(0.42 0.005 60)' },
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
              'radial-gradient(ellipse at center, oklch(0.65 0.14 60 / 0.055) 0%, transparent 70%)',
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
          <motion.div
            className="inline-flex items-center gap-3 border px-3.5 py-1.5"
            style={{ borderColor: 'oklch(0.45 0.08 65 / 0.45)' }}
            variants={fadeUp}
          >
            <span
              className="w-1.5 h-1.5 rotate-45 shrink-0"
              style={{ backgroundColor: 'var(--color-accent)' }}
            />
            <span
              className="font-mono uppercase tracking-[0.28em] text-[10px] sm:text-xs"
              style={{ color: 'oklch(0.72 0.12 65 / 0.7)' }}
            >
              Track together · Remember always
            </span>
          </motion.div>

          <motion.h1
            className="font-serif font-light text-stone-100 leading-[0.92] tracking-tight"
            style={{ fontSize: 'clamp(2.6rem, 6vw + 1rem, 6rem)' }}
            variants={fadeUp}
          >
            The Friend
            <br />
            <span style={{ color: 'var(--color-accent)' }}>Archive</span>
          </motion.h1>

          <motion.p
            className="text-stone-400 max-w-xl font-light leading-relaxed"
            style={{ fontSize: 'clamp(1rem, 0.5vw + 0.9rem, 1.18rem)' }}
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
              <span className="font-serif text-xl text-stone-100 truncate">Friday Night Crew</span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.2em] whitespace-nowrap"
                style={{ color: 'oklch(0.42 0.005 60)' }}
              >
                Catalogue Nº 027
              </span>
            </div>
            <ul>
              {HERO_LEDGER.map((row) => (
                <li
                  key={row.n}
                  className="px-5 py-3 flex items-center gap-4 border-b last:border-b-0"
                  style={{ borderColor: 'oklch(0.24 0.005 60 / 0.55)' }}
                >
                  <span
                    className="font-mono text-[10px] tracking-wider shrink-0"
                    style={{ color: 'oklch(0.36 0.005 60)' }}
                  >
                    {row.n}
                  </span>
                  <span className="text-sm text-stone-200 font-light truncate flex-1">
                    {row.title}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider hidden sm:block shrink-0"
                    style={{ color: 'oklch(0.36 0.005 60)' }}
                  >
                    {row.type}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider shrink-0"
                    style={{ color: row.statusColor }}
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: 'oklch(0.42 0.005 60)' }}
              >
                6 friends · 14 titles · est. 2024
              </span>
            </div>
          </div>

          {/* Rubber-stamp mark */}
          <motion.div
            className="absolute -top-3 -right-2 sm:-right-4 rotate-6 border-2 px-3 py-1 select-none"
            style={{
              borderColor: 'oklch(0.55 0.12 60 / 0.55)',
              backgroundColor: 'var(--color-background)',
            }}
            initial={{ opacity: 0, scale: 1.4, rotate: 6 }}
            animate={{ opacity: 1, scale: 1, rotate: 6 }}
            transition={{ duration: 0.35, ease: EASE, delay: 1.15 }}
            aria-hidden
          >
            <span
              className="font-mono text-[10px] uppercase tracking-[0.3em]"
              style={{ color: 'oklch(0.68 0.12 60 / 0.8)' }}
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
            className="flex items-center gap-x-5 sm:gap-x-8 font-mono uppercase tracking-[0.3em] text-xs"
            style={{ color: 'oklch(0.42 0.005 60)' }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: i * 0.09, duration: 0.55 }}
          >
            {i > 0 && (
              <span
                className="w-1 h-1 rotate-45 shrink-0"
                style={{ backgroundColor: 'oklch(0.55 0.12 60 / 0.5)' }}
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
              className="font-mono text-xs uppercase tracking-[0.3em]"
              style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
            >
              How it works
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-serif text-4xl sm:text-5xl text-stone-100 font-light leading-[1.05] max-w-lg"
            >
              Simple by design.{' '}
              <em className="not-italic" style={{ color: 'var(--color-accent)' }}>
                Shared
              </em>{' '}
              by nature.
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {steps.map((step) => (
              <motion.div
                key={step.number}
                variants={fadeUp}
                className="relative pt-8 pb-10 pr-0 sm:pr-10 border-t-2 border-stone-800/60"
              >
                <span
                  className="absolute -top-0.5 left-0 w-12 h-0.5"
                  style={{ backgroundColor: 'oklch(0.55 0.12 60 / 0.6)' }}
                  aria-hidden
                />
                <span
                  className="font-mono font-light leading-none block mb-6 select-none"
                  style={{ fontSize: 'clamp(3.6rem, 4vw + 1.5rem, 4.8rem)', color: 'oklch(0.24 0.02 60)' }}
                >
                  {step.number}
                </span>
                <h3 className="font-serif text-xl text-stone-100 mb-3">{step.title}</h3>
                <p className="text-stone-500 text-sm font-light leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
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
            className="font-mono text-xs uppercase tracking-[0.3em]"
            style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
          >
            Shared catalogues
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="font-serif text-4xl sm:text-5xl text-stone-100 font-light leading-[1.05]"
          >
            One place for everything your group wants to experience
          </motion.h2>
          <motion.p variants={fadeUp} className="text-stone-400 text-base leading-relaxed font-light">
            No more scattered chat threads. Your archive keeps every title, every recommendation,
            every plan in one shared catalogue — visible to the whole group.
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
            <span className="font-serif text-xl text-stone-100">Cinema Crew</span>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.4 0.005 60)' }}>
              6 members
            </span>
          </div>
          <div className="border-b border-stone-800/60 px-5 py-2.5 flex gap-5 overflow-x-auto">
            {['All (14)', 'Movies (9)', 'TV (3)', 'Books (2)'].map((tab, i) => (
              <span
                key={tab}
                className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap"
                style={
                  i === 0
                    ? {
                        color: 'var(--color-accent)',
                        borderBottom: '1px solid var(--color-accent)',
                        paddingBottom: '4px',
                        marginBottom: '-10px',
                      }
                    : { color: 'oklch(0.38 0.005 60)' }
                }
              >
                {tab}
              </span>
            ))}
          </div>
          {[
            { title: 'Dune: Part Two', type: 'Movie', status: 'Watched', statusColor: 'oklch(0.72 0.14 160)' },
            { title: 'The Bear', type: 'TV', status: 'Watching', statusColor: 'oklch(0.78 0.13 62)' },
            { title: 'Interstellar', type: 'Movie', status: 'Plan to Watch', statusColor: 'oklch(0.4 0.005 60)' },
            { title: 'Poor Things', type: 'Movie', status: 'Plan to Watch', statusColor: 'oklch(0.4 0.005 60)' },
            { title: 'Station Eleven', type: 'TV', status: 'Watched', statusColor: 'oklch(0.72 0.14 160)' },
          ].map((row) => (
            <div
              key={row.title}
              className="px-5 py-3.5 border-b border-stone-800/30 flex items-center justify-between gap-4"
            >
              <span className="text-sm text-stone-200 font-light truncate">{row.title}</span>
              <div className="flex items-center gap-5 shrink-0">
                <span
                  className="font-mono text-[10px] uppercase tracking-wider hidden sm:block"
                  style={{ color: 'oklch(0.35 0.005 60)' }}
                >
                  {row.type}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-wider"
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
            <span className="font-serif text-xl text-stone-100 truncate">Dune: Part Two</span>
            <span
              className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap"
              style={{ color: 'oklch(0.4 0.005 60)' }}
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
                    className="w-6 h-6 flex items-center justify-center border font-mono text-[10px] uppercase shrink-0 select-none"
                    style={{
                      borderColor: user.isYou ? 'oklch(0.45 0.1 65 / 0.6)' : 'var(--color-border)',
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
                  <span className="font-mono text-[10px]" style={{ color: 'oklch(0.36 0.005 60)' }}>
                    {user.date}
                  </span>
                  {user.isYou && (
                    <span
                      className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border"
                      style={{
                        borderColor: 'oklch(0.35 0.1 65)',
                        color: 'oklch(0.65 0.1 65)',
                      }}
                    >
                      you
                    </span>
                  )}
                </div>
                {user.note ? (
                  <p
                    className="text-xs font-light leading-relaxed pl-9"
                    style={{ color: 'oklch(0.48 0.005 60)' }}
                  >
                    "{user.note}"
                  </p>
                ) : (
                  <p
                    className="text-xs font-mono italic pl-9"
                    style={{ color: 'oklch(0.36 0.005 60)' }}
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
            className="font-mono text-xs uppercase tracking-[0.3em]"
            style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
          >
            Personal tracking
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="font-serif text-4xl sm:text-5xl text-stone-100 font-light leading-[1.05]"
          >
            Your progress. Your notes. Your memory.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-stone-400 text-base leading-relaxed font-light">
            Mark items as planned, in progress, or completed. Leave a personal note about what you
            thought — only you can see it. Check who in your group has consumed something, without
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
              className="font-mono text-xs uppercase tracking-[0.3em]"
              style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
            >
              Media types
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-serif text-4xl sm:text-5xl text-stone-100 font-light leading-[1.05] max-w-lg"
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
                      borderColor: 'oklch(0.45 0.08 65 / 0.35)',
                    }}
                  >
                    <Icon className="h-[18px] w-[18px]" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <h3 className="font-serif text-2xl text-stone-100">{label}</h3>
                </div>
                <p className="text-stone-500 text-sm font-light leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Pricing teaser ───────────────────────────────────────────────────────────

const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'forever',
    features: ['2 groups created', '5 total groups', 'Unlimited media items', 'Personal notes'],
    cta: 'Get started',
    ctaHref: '/register',
    highlight: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '€3',
    period: 'per month',
    features: [
      '10 groups created',
      'Unlimited groups joined',
      'Unlimited media items',
      'Personal notes',
      'Priority support',
    ],
    cta: 'Upgrade',
    ctaHref: '/upgrade',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    features: ['Unlimited groups', 'Everything in Premium', 'Custom onboarding'],
    cta: 'Contact us',
    ctaHref: 'mailto:hello@thefriendarchive.com',
    highlight: false,
  },
] as const;

function PricingTeaserSection() {
  const { ref, isInView } = useScrollReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="border-t border-stone-800/50 py-16 sm:py-24 lg:py-32"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="space-y-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-4">
              <motion.p
                variants={fadeUp}
                className="font-mono text-xs uppercase tracking-[0.3em]"
                style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
              >
                Pricing
              </motion.p>
              <motion.h2
                variants={fadeUp}
                className="font-serif text-3xl sm:text-4xl lg:text-5xl text-stone-100 font-light leading-[1.05] max-w-xl"
              >
                Start free. Upgrade when you need more.
              </motion.h2>
            </div>
            <motion.div variants={fadeUp} className="shrink-0">
              <Link href="/pricing">
                <Button variant="ghost" size="sm">
                  Full pricing details
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            variants={staggerContainer(0.07)}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
          >
            {PRICING_PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                variants={fadeUp}
                className="border p-6 space-y-5"
                style={{
                  borderColor: plan.highlight ? 'oklch(0.55 0.12 60 / 0.5)' : 'var(--color-border)',
                  backgroundColor: plan.highlight
                    ? 'oklch(0.14 0.04 60 / 0.2)'
                    : 'var(--color-background)',
                  boxShadow: plan.highlight ? 'var(--shadow-2)' : 'none',
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p
                      className="font-mono text-xs uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {plan.name}
                    </p>
                    {plan.highlight && (
                      <span
                        className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                        style={{
                          backgroundColor: 'oklch(0.55 0.12 60 / 0.12)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-3xl text-stone-100">{plan.price}</span>
                    <span
                      className="font-mono text-xs"
                      style={{ color: 'oklch(0.38 0.005 60)' }}
                    >
                      / {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-xs font-mono"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <span style={{ color: 'var(--color-accent)' }} className="shrink-0 mt-0.5">
                        ◆
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={plan.ctaHref}>
                  <Button
                    variant={plan.highlight ? 'default' : 'outline'}
                    className="w-full"
                    size="sm"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="font-mono text-xs text-center"
            style={{ color: 'oklch(0.38 0.005 60)' }}
          >
            No credit card required to start. Cancel or upgrade at any time.
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
            width: 'min(680px, 100vw)',
            height: 'min(380px, 80%)',
            background:
              'radial-gradient(ellipse at center, oklch(0.65 0.14 60 / 0.05) 0%, transparent 70%)',
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
          className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-100 font-light leading-[0.95]"
        >
          Start archiving
          <br />
          <span style={{ color: 'var(--color-accent)' }}>together.</span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="text-stone-400 font-light leading-relaxed max-w-sm mx-auto"
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
        <span
          className="font-mono uppercase tracking-widest text-xs"
          style={{ color: 'oklch(0.38 0.005 60)' }}
        >
          The Friend Archive
        </span>
        <div className="flex gap-6">
          {[
            { href: '/pricing', label: 'Pricing' },
            { href: '/discover', label: 'Discover' },
            { href: '/register', label: 'Get started' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-mono text-xs uppercase tracking-wider transition-colors"
              style={{ color: 'oklch(0.38 0.005 60)' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
