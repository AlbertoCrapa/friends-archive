import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaTable } from '@/components/features/media/MediaTable';
import { Check, Minus, Globe, Lock, Plus, Compass } from 'lucide-react';
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';

interface Props {
  searchParams: Promise<{ scenario?: string; surface?: string }>;
}

type ScenarioKey = 'empty' | 'minimal' | 'typical' | 'dense' | 'overflow';

const scenarios: Array<{ key: ScenarioKey; label: string; count: number }> = [
  { key: 'empty', label: 'Empty', count: 0 },
  { key: 'minimal', label: 'Minimal', count: 2 },
  { key: 'typical', label: 'Typical', count: 20 },
  { key: 'dense', label: 'Dense', count: 60 },
  { key: 'overflow', label: 'Overflow', count: 140 },
];

const surfaces = ['all', 'landing', 'dashboard', 'discover', 'group', 'pricing', 'loading', 'media-table', 'profile', 'settings'] as const;
type Surface = (typeof surfaces)[number];

export default async function UIStressPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeScenario =
    scenarios.find((s) => s.key === params.scenario)?.key ?? 'typical';
  const activeSurface: Surface =
    (surfaces.find((s) => s === params.surface) as Surface | undefined) ?? 'all';
  const itemCount = scenarios.find((s) => s.key === activeScenario)?.count ?? 20;

  const mediaItems = buildMediaItems(itemCount);
  const consumedSet = new Set(mediaItems.filter((_, i) => i % 3 === 0).map((m) => m.id));
  const groups = buildGroups(itemCount);

  const show = (surface: Surface) =>
    activeSurface === 'all' || activeSurface === surface;

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-10">
        {/* Header */}
        <header className="space-y-3 border-b border-stone-800/50 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
            Stress validation surface — no auth required
          </p>
          <h1 className="font-serif text-4xl text-stone-100">UI Stress Preview</h1>
          <p className="max-w-2xl text-sm text-stone-400 font-light leading-relaxed">
            Injects mock data directly into component patterns to validate density, truncation,
            mobile touch targets, and motion at multiple data volumes across all key surfaces.
          </p>

          {/* Scenario selector */}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="font-mono text-xs text-stone-600 self-center mr-1">Scenario:</span>
            {scenarios.map((s) => (
              <Link key={s.key} href={`/ui-stress?scenario=${s.key}&surface=${activeSurface}`}>
                <Button variant={activeScenario === s.key ? 'default' : 'outline'} size="sm">
                  {s.label} ({s.count})
                </Button>
              </Link>
            ))}
          </div>

          {/* Surface selector */}
          <div className="flex flex-wrap gap-2">
            <span className="font-mono text-xs text-stone-600 self-center mr-1">Surface:</span>
            {surfaces.map((s) => (
              <Link key={s} href={`/ui-stress?scenario=${activeScenario}&surface=${s}`}>
                <Button
                  variant={activeSurface === s ? 'secondary' : 'ghost'}
                  size="sm"
                  className="capitalize"
                >
                  {s === 'all' ? 'All surfaces' : s.replace('-', ' ')}
                </Button>
              </Link>
            ))}
          </div>
        </header>

        {/* ── LANDING surface ────────────────────────────────────────────── */}
        {show('landing') && (
          <section className="space-y-6">
            <SectionHeading>Landing page — hero + features</SectionHeading>

            {/* Hero mock */}
            <div className="border border-stone-800/50 p-10 text-center space-y-6 bg-stone-950 relative overflow-hidden">
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, oklch(0.65 0.14 60 / 0.04) 0%, transparent 70%)' }}
                aria-hidden
              />
              <p className="font-mono uppercase tracking-[0.35em] text-xs" style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}>
                Track together. Remember always.
              </p>
              <h1
                className="font-serif font-light text-stone-100 leading-[0.9]"
                style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)' }}
              >
                The Friend<br />
                <span style={{ color: 'var(--color-accent)' }}>Archive</span>
              </h1>
              <p className="text-stone-400 max-w-md mx-auto font-light text-base leading-relaxed">
                A shared catalogue for everything worth experiencing together.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg">Create your archive</Button>
                <Button variant="ghost" size="lg">Sign in</Button>
              </div>
            </div>

            {/* How it works mock */}
            <div className="border border-stone-800/50 p-8 space-y-8">
              <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}>
                How it works
              </p>
              <h2 className="font-serif text-4xl text-stone-100 font-light">Simple by design. Shared by nature.</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
                {['Create a group', 'Add what you want to experience', 'Track and remember together'].map((title, i) => (
                  <div key={title} className="pt-8 pb-10 pr-0 sm:pr-10 border-t-2 border-stone-800/60 space-y-3">
                    <span className="font-mono font-light block" style={{ fontSize: '4.8rem', color: 'oklch(0.20 0.005 60)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="font-serif text-xl text-stone-100">{title}</h3>
                    <p className="text-stone-500 text-sm font-light leading-relaxed">
                      Step description that explains the action with a bit of context about what the user experiences.
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Media categories mock */}
            <div className="border border-stone-800/50 grid grid-cols-1 sm:grid-cols-2">
              {[
                { label: 'Movies', desc: 'Feature films with director, release year, and runtime.' },
                { label: 'TV Series', desc: 'Series tracking with season count and platform.' },
                { label: 'Books', desc: 'Author, publisher, and publication year.' },
                { label: 'Video Games', desc: 'Developer, publisher, platform. Keep track of the backlog.' },
              ].map(({ label, desc }) => (
                <div key={label} className="p-8 space-y-3 border-b border-r border-stone-800/40">
                  <h3 className="font-serif text-xl text-stone-100">{label}</h3>
                  <p className="text-stone-500 text-sm font-light leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── DASHBOARD surface ──────────────────────────────────────────── */}
        {show('dashboard') && (
          <section className="space-y-6">
            <SectionHeading>Dashboard cards — {groups.length > 0 ? `${groups.length} groups` : 'empty state'}</SectionHeading>

            {groups.length === 0 ? (
              <div className="border border-stone-800/50 py-24 text-center space-y-6">
                <p className="font-serif text-2xl text-stone-500">No archives yet</p>
                <p className="text-stone-600 text-sm font-mono max-w-sm mx-auto">
                  Create a group for your crew, or discover what others are archiving together.
                </p>
                <div className="flex justify-center gap-3">
                  <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Create a group</Button>
                  <Button variant="outline" size="sm" className="gap-2"><Compass className="h-3.5 w-3.5" />Discover</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.slice(0, 12).map((g) => (
                  <div
                    key={g.id}
                    className="border border-stone-800/50 p-5 hover:border-amber-800/50 hover:bg-stone-900/30 cursor-pointer transition-all space-y-3 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-lg text-stone-100 line-clamp-2 leading-snug">{g.name}</h3>
                      <Badge variant={g.visibility === 'public' ? 'public' : 'private'} className="shrink-0 gap-1">
                        {g.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        {g.visibility === 'public' ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                    <p className="text-stone-500 text-sm font-light line-clamp-2 flex-1">{g.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono" style={{ color: 'oklch(0.4 0.005 60)' }}>
                        {g.memberCount} members · {g.itemCount} items
                      </span>
                      <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--color-accent)' }}>owner</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── DISCOVER surface ──────────────────────────────────────────── */}
        {show('discover') && (
          <section className="space-y-6">
            <SectionHeading>Discover grid — public groups with join/view</SectionHeading>
            {groups.length === 0 ? (
              <div className="border border-stone-800/50 py-24 text-center space-y-5">
                <p className="font-serif text-2xl text-stone-500">No public archives yet</p>
                <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Create a group</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.filter((g) => g.visibility === 'public').slice(0, 9).map((g, i) => (
                  <div
                    key={g.id}
                    className="border border-stone-800/50 p-5 space-y-3 flex flex-col hover:border-amber-800/50 hover:bg-stone-900/30 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-lg text-stone-100 line-clamp-2 leading-snug">{g.name}</h3>
                      <Badge variant="public" className="shrink-0 gap-1"><Globe className="h-2.5 w-2.5" /> Public</Badge>
                    </div>
                    <p className="text-stone-500 text-sm font-light line-clamp-2 flex-1">{g.description}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs font-mono" style={{ color: 'oklch(0.4 0.005 60)' }}>
                        {g.memberCount} members · {g.itemCount} items
                      </span>
                      {i % 2 === 0 ? (
                        <Button variant="outline" size="sm">Join</Button>
                      ) : (
                        <Button variant="ghost" size="sm">View</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── GROUP DETAIL surface ───────────────────────────────────────── */}
        {show('group') && (
          <section className="space-y-6">
            <SectionHeading>Group detail — header + media table</SectionHeading>

            {/* Group header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <Button variant="ghost" size="sm">← Back to dashboard</Button>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-serif text-3xl text-stone-100">
                    {groups[0]?.name ?? 'Cinema Crew'}
                  </h2>
                  <Badge variant="public" className="gap-1"><Globe className="h-2.5 w-2.5" /> Public</Badge>
                </div>
                <p className="text-stone-500 text-sm font-light">
                  {groups[0]?.description ?? 'A group for tracking movies and series together.'}
                </p>
                <p className="text-xs font-mono text-stone-600">
                  {groups[0]?.memberCount ?? 4} members
                </p>
              </div>
              <Button variant="outline" size="sm">Settings</Button>
            </div>

            {/* Filter tabs */}
            <div className="border-b border-stone-900 pb-3 flex gap-0 overflow-x-auto">
              {['All', 'Movies', 'TV Series', 'Books', 'Games'].map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className={`cursor-pointer min-h-11 px-4 py-2 text-sm font-mono uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap transition-colors ${
                    i === 0
                      ? 'text-amber-500 border-amber-500'
                      : 'text-stone-500 border-transparent hover:text-stone-300'
                  }`}
                >
                  {tab} ({i === 0 ? mediaItems.length : Math.floor(mediaItems.length / 4)})
                </button>
              ))}
            </div>

            {/* Media table */}
            <MediaTable
              items={mediaItems}
              consumedSet={consumedSet}
              activeType="all"
              isMember={true}
              userId="stress-user"
              currentUserNickname="stress-user"
            />
          </section>
        )}

        {/* ── PRICING surface ────────────────────────────────────────────── */}
        {show('pricing') && (
          <section className="space-y-8">
            <SectionHeading>Pricing page — plans + comparison table</SectionHeading>

            {/* Plan cards */}
            <div className="border border-stone-800/50 grid grid-cols-1 sm:grid-cols-3">
              {[
                { name: 'Free', price: '€0', period: 'forever', highlight: false, popular: false },
                { name: 'Premium', price: '€3', period: 'per month', highlight: true, popular: true },
                { name: 'Enterprise', price: 'Custom', period: 'contact us', highlight: false, popular: false },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className="p-8 space-y-6 border-b sm:border-b-0 sm:border-r border-stone-800/50 last:border-r-0 relative"
                  style={plan.highlight ? { backgroundColor: 'oklch(0.115 0.015 60)' } : {}}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 inset-x-0 h-0.5" style={{ backgroundColor: 'var(--color-accent)' }} />
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: plan.highlight ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {plan.name}
                      </p>
                      {plan.popular && (
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border" style={{ borderColor: 'oklch(0.55 0.12 60 / 0.4)', color: 'var(--color-accent)' }}>
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-5xl text-stone-100 font-light">{plan.price}</span>
                      <span className="font-mono text-xs" style={{ color: 'oklch(0.38 0.005 60)' }}>/ {plan.period}</span>
                    </div>
                  </div>
                  <Button variant={plan.highlight ? 'default' : 'outline'} className="w-full">
                    {plan.name === 'Free' ? 'Get started' : plan.name === 'Enterprise' ? 'Contact us' : 'Upgrade'}
                  </Button>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <div className="border border-stone-800/50 overflow-x-auto">
              <div className="grid border-b border-stone-800/50" style={{ gridTemplateColumns: '1fr repeat(3, minmax(80px, 140px))' }}>
                <div className="p-4" />
                {['Free', 'Premium', 'Enterprise'].map((p, i) => (
                  <div key={p} className="p-4 text-center border-l border-stone-800/50" style={i === 1 ? { backgroundColor: 'oklch(0.115 0.015 60)' } : {}}>
                    <p className="font-mono text-xs uppercase tracking-[0.25em]" style={{ color: i === 1 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{p}</p>
                  </div>
                ))}
              </div>
              {[
                ['Groups created', 'Up to 2', 'Up to 10', 'Unlimited'],
                ['Groups joined', 'Up to 5', 'Unlimited', 'Unlimited'],
                ['Media items', 'Unlimited', 'Unlimited', 'Unlimited'],
                ['Personal notes', true, true, true],
                ['Priority support', false, true, true],
                ['Custom onboarding', false, false, true],
              ].map((row, i) => (
                <div key={i} className="grid border-b border-stone-800/30 last:border-b-0" style={{ gridTemplateColumns: '1fr repeat(3, minmax(80px, 140px))' }}>
                  <div className="px-4 py-3.5 text-sm text-stone-200 font-light">{row[0] as string}</div>
                  {([1, 2, 3] as const).map((col) => (
                    <div key={col} className="px-4 py-3.5 flex items-center justify-center border-l border-stone-800/30" style={col === 2 ? { backgroundColor: 'oklch(0.115 0.015 60)' } : {}}>
                      {typeof row[col] === 'boolean' ? (
                        row[col] ? (
                          <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <Minus className="h-4 w-4" style={{ color: 'oklch(0.32 0.005 60)' }} />
                        )
                      ) : (
                        <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row[col] as string}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── LOADING SKELETONS surface ─────────────────────────────────── */}
        {show('loading') && (
          <section className="space-y-8">
            <SectionHeading>Loading skeletons — all routes</SectionHeading>

            {/* Dashboard loading */}
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-wider text-stone-600">Dashboard</p>
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-52" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="border border-stone-800/50 p-5 space-y-3">
                      <div className="flex justify-between gap-2">
                        <Skeleton className="h-6 w-2/3" /><Skeleton className="h-5 w-16 shrink-0" />
                      </div>
                      <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" />
                      <div className="flex justify-between"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-12" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Group detail loading */}
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-wider text-stone-600">Group detail</p>
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-24" />
                    <div className="flex gap-3"><Skeleton className="h-9 w-60" /><Skeleton className="h-5 w-16 shrink-0" /></div>
                    <Skeleton className="h-4 w-80 max-w-full" /><Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-10 w-28 shrink-0" />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-24" />)}
                </div>
                <div className="border border-stone-800/50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-4 border-b border-stone-800/30 flex gap-4">
                      <div className="space-y-1.5 flex-1"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-2/5" /></div>
                      <Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-32" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── MEDIA TABLE standalone ────────────────────────────────────── */}
        {show('media-table') && (
          <section className="space-y-6">
            <SectionHeading>Media table — {mediaItems.length} items, all types, member view</SectionHeading>
            <MediaTable
              items={mediaItems}
              consumedSet={consumedSet}
              activeType="all"
              isMember={true}
              userId="stress-user"
              currentUserNickname="stress-user"
            />

            <SectionHeading>Media table — read-only (non-member)</SectionHeading>
            <MediaTable
              items={mediaItems.slice(0, 10)}
              consumedSet={new Set()}
              activeType="all"
              isMember={false}
              userId="stress-user"
              currentUserNickname={null}
            />

            <SectionHeading>Media table — empty state</SectionHeading>
            <MediaTable
              items={[]}
              consumedSet={new Set()}
              activeType="all"
              isMember={true}
              userId="stress-user"
              currentUserNickname="stress-user"
            />
          </section>
        )}

        {/* ── PROFILE surface ────────────────────────────────────────────── */}
        {show('profile') && (
          <section className="space-y-6">
            <SectionHeading>Profile page — own profile with stats + group list</SectionHeading>

            {/* Stats bar */}
            <div className="max-w-2xl space-y-6">
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'oklch(0.72 0.12 65 / 0.6)' }}>Your profile</p>
                <h2 className="font-serif text-5xl text-stone-100 font-light">stress_user</h2>
                <p className="font-mono text-xs" style={{ color: 'oklch(0.38 0.005 60)' }}>Member since 1 January 2025</p>
              </div>
              <div className="flex items-stretch border border-stone-800/50 overflow-hidden">
                {[
                  { label: 'Archives', value: groups.length },
                  { label: 'Owned', value: Math.ceil(groups.length / 2) },
                  { label: 'Consumed', value: Math.floor(groups.length * 3.7) },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className="flex-1 px-5 py-4 space-y-1 border-r border-stone-800/50 last:border-r-0"
                    style={i === 0 ? { backgroundColor: 'var(--color-surface)' } : {}}
                  >
                    <p className="font-serif text-2xl text-stone-100">{stat.value}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.4 0.005 60)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Group list */}
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'oklch(0.42 0.005 60)' }}>
                  Your archives ({groups.length})
                </p>
                <div className="border border-stone-800/50">
                  {groups.slice(0, 10).map((g) => (
                    <div key={g.id} className="border-b border-stone-800/30 last:border-b-0">
                      <div className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-stone-900/30 cursor-pointer transition-colors">
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-serif text-base text-stone-100 leading-snug">{g.name}</span>
                            <Badge variant={g.visibility === 'public' ? 'public' : 'private'} className="gap-1 shrink-0">
                              {g.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                              {g.visibility === 'public' ? 'Public' : 'Private'}
                            </Badge>
                          </div>
                          <p className="text-sm font-light line-clamp-1" style={{ color: 'oklch(0.42 0.005 60)' }}>{g.description}</p>
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          <p className="font-mono text-xs" style={{ color: 'oklch(0.38 0.005 60)' }}>{g.itemCount} items</p>
                          <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>owner</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── SETTINGS surface ───────────────────────────────────────────── */}
        {show('settings') && (
          <section className="space-y-6">
            <SectionHeading>Group settings — form, members list, danger zone</SectionHeading>
            <div className="max-w-2xl space-y-10">
              {/* Group info form */}
              <div className="space-y-5">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'oklch(0.42 0.005 60)' }}>Group info</h3>
                <div className="space-y-2">
                  <label className="font-mono text-xs uppercase tracking-wider text-stone-500">Name</label>
                  <div className="h-11 border border-stone-700 px-3 flex items-center">
                    <span className="text-stone-300 text-sm">{groups[0]?.name ?? 'Cinema Crew'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-xs uppercase tracking-wider text-stone-500">Description</label>
                  <div className="h-24 border border-stone-700 px-3 py-2">
                    <span className="text-stone-300 text-sm font-light">{groups[0]?.description ?? 'Group description...'}</span>
                  </div>
                </div>
                <Button size="sm">Save changes</Button>
              </div>

              {/* Members */}
              <div className="space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'oklch(0.42 0.005 60)' }}>Members</h3>
                <div className="border border-stone-800/50">
                  {Array.from({ length: Math.min(5, Math.max(1, groups.length)) }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800/30 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-stone-200">user{i + 1}</span>
                        <span className="font-mono text-[10px] uppercase" style={{ color: i === 0 ? 'var(--color-accent)' : 'oklch(0.4 0.005 60)' }}>
                          {i === 0 ? 'owner' : 'member'}
                        </span>
                      </div>
                      {i > 0 && (
                        <Button variant="ghost" size="icon" className="h-11 w-11 text-stone-600">
                          <span className="text-xs">✕</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div className="space-y-5">
                <div className="border-t border-stone-800/50 pt-5">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'oklch(0.6 0.18 15)' }}>Danger zone</h3>
                </div>
                <div className="border p-5 space-y-4" style={{ borderColor: 'oklch(0.5 0.18 15 / 0.3)', backgroundColor: 'oklch(0.12 0.04 15 / 0.15)' }}>
                  <p className="text-stone-200 text-sm font-light">Delete <span className="font-mono text-stone-100">{groups[0]?.name ?? 'Cinema Crew'}</span></p>
                  <p className="text-stone-500 text-sm font-light">Permanently removes all media items and consumption records. This cannot be undone.</p>
                  <Button variant="outline" size="sm" className="gap-2 border-red-900/50 text-red-400">
                    Delete group
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// ─── Section heading helper ───────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-stone-800/50 pb-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">{children}</h2>
    </div>
  );
}

// ─── Mock data builders ───────────────────────────────────────────────────────

function buildGroups(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `group-${i + 1}`,
    name:
      i % 4 === 0
        ? `This is a very long group name number ${i + 1} to stress truncation and alignment stability in card patterns`
        : i % 7 === 0
          ? `G${i + 1}`
          : `Group ${i + 1}`,
    description:
      i % 5 === 0
        ? 'Tiny description.'
        : `Collaborative archive description for group ${i + 1}. This sentence intentionally varies in length to validate wrapping and line clamping across viewports.`,
    visibility: i % 2 === 0 ? 'public' : 'private',
    memberCount: Math.max(1, Math.floor((i + 2) * 1.7)),
    itemCount: Math.max(0, Math.floor((i + 1) * 2.3)),
  }));
}

function buildMediaItems(count: number): MediaItemWithDetails[] {
  return Array.from({ length: count }, (_, i) => {
    const type = mediaTypeFor(i);
    const status = statusFor(i);
    return {
      id: `media-${i + 1}`,
      group_id: 'stress-group',
      title:
        i % 6 === 0
          ? `Extremely long media title ${i + 1} used to test overflow, truncation, and card integrity with variable-length text content across viewports`
          : i % 7 === 0
            ? `X${i + 1}`
            : `Media Item ${i + 1}`,
      type,
      status,
      genre: i % 3 === 0 ? 'Drama, Mystery, Documentary, Science Fiction' : 'Action',
      metadata: metadataFor(type, i),
      added_by: `user-${(i % 12) + 1}`,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
      added_by_profile: {
        nickname:
          i % 5 === 0
            ? `very_long_nickname_stress_${i + 1}`
            : `user${(i % 12) + 1}`,
      },
      consumption_records:
        i % 2 === 0
          ? [
              {
                id: `record-${i + 1}`,
                media_item_id: `media-${i + 1}`,
                user_id: i % 4 === 0 ? 'stress-user' : `other-${i}`,
                consumed_at: new Date(Date.now() - i * 7200000).toISOString(),
                note:
                  i % 8 === 0
                    ? 'Very long personal note for stress testing layout balance under dense textual metadata in the consumed by dialog.'
                    : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                profile: {
                  nickname: i % 4 === 0 ? 'stress-user' : `other${i + 1}`,
                },
              },
            ]
          : [],
    };
  });
}

function mediaTypeFor(i: number): MediaType {
  return (['movie', 'tv_series', 'book', 'video_game'] as MediaType[])[i % 4];
}

function statusFor(i: number): ItemStatus {
  return (['plan_to_consume', 'consuming', 'completed'] as ItemStatus[])[i % 3];
}

function metadataFor(type: MediaType, i: number): Record<string, unknown> {
  if (type === 'movie')
    return { director: i % 5 === 0 ? 'Long Director Name For Overflow Validation' : 'Director', release_year: 1990 + (i % 30), duration_minutes: 80 + (i % 90) };
  if (type === 'tv_series')
    return { creator: 'Creator', release_year: 1995 + (i % 25), seasons: 1 + (i % 10), platform: i % 3 === 0 ? 'VeryLongPlatformNameForTesting' : 'StreamNow' };
  if (type === 'book')
    return { author: i % 3 === 0 ? 'Author With Long Name Variant For Layout' : 'Author', publication_year: 1960 + (i % 60) };
  return { developer: i % 2 === 0 ? 'Studio' : 'Very Long Developer Studio Name For Edge Testing', release_year: 1980 + (i % 40) };
}
