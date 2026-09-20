import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaTable } from '@/components/features/media/MediaTable';
import { GroupMediaSection } from '@/components/features/media/GroupMediaSection';
import { DashboardContent } from '@/components/features/groups/DashboardContent';
import { DiscoverList } from '@/components/features/groups/DiscoverList';
import { Check, Minus, Globe, Lock, Users } from 'lucide-react';
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';

interface Props {
  searchParams: Promise<{ scenario?: string; surface?: string; view?: string }>;
}

type ScenarioKey = 'empty' | 'minimal' | 'typical' | 'dense' | 'overflow';

const scenarios: Array<{ key: ScenarioKey; label: string; count: number }> = [
  { key: 'empty', label: 'Empty', count: 0 },
  { key: 'minimal', label: 'Minimal', count: 2 },
  { key: 'typical', label: 'Typical', count: 20 },
  { key: 'dense', label: 'Dense', count: 60 },
  { key: 'overflow', label: 'Overflow', count: 140 },
];

const surfaces = ['all', 'landing', 'dashboard', 'discover', 'group', 'archive', 'pricing', 'loading', 'media-table', 'profile', 'settings'] as const;
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
          <p className="font-mono text-xs text-stone-500">
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
                style={{ background: 'radial-gradient(ellipse at center, #a87a000a 0%, transparent 70%)' }}
                aria-hidden
              />
              <p className="font-mono text-xs" style={{ color: '#d69b00a6' }}>
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
              <p className="font-mono text-xs " style={{ color: '#d69b00a6' }}>
                How it works
              </p>
              <h2 className="font-serif text-4xl text-stone-100 font-light">Simple by design. Shared by nature.</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
                {['Create a group', 'Add what you want to experience', 'Track and remember together'].map((title, i) => (
                  <div key={title} className="pt-8 pb-10 pr-0 sm:pr-10 border-t-2 border-stone-800/60 space-y-3">
                    <span className="font-mono font-light block" style={{ fontSize: '4.8rem', color: '#27272a' }}>
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
            <SectionHeading>Dashboard — the real component, mock data</SectionHeading>
            <DashboardContent {...buildDashboardProps(groups)} />
          </section>
        )}

        {/* ── DISCOVER surface ──────────────────────────────────────────── */}
        {show('discover') && (
          <section className="space-y-6">
            <SectionHeading>Discover — the real component, mock data</SectionHeading>
            <DiscoverList groups={buildDiscoverGroups(groups)} isAuthenticated />
          </section>
        )}

        {/* ── GROUP DETAIL surface ───────────────────────────────────────── */}
        {show('group') && (
          <section className="space-y-6">
            <SectionHeading>Group detail — header + media table</SectionHeading>

            {/* Group header — mirrors app/(dashboard)/groups/[groupId]/page.tsx */}
            <header className="space-y-3">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-stone-500">
                ← My archives
              </span>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0 space-y-2">
                  <h2 className="page-title">{groups[0]?.name ?? 'Cinema Crew'}</h2>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-stone-800 px-1.5 py-0.5 text-[11.5px] font-medium text-stone-400">
                      <Globe className="h-2.5 w-2.5" /> Public
                    </span>
                  </div>

                  <p className="max-w-2xl text-[13.5px] leading-relaxed text-stone-500">
                    {groups[0]?.description ?? 'A group for tracking movies and series together.'}
                  </p>

                  <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-stone-500">
                    <Users className="h-3.5 w-3.5 shrink-0 text-stone-600" aria-hidden />
                    <span className="shrink-0 font-medium text-stone-400">6 members</span>
                    <span aria-hidden className="shrink-0 text-stone-700">·</span>
                    <span className="truncate">maya, theo, ines, bruno, nico and 1 more</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm">Share</Button>
                  <Button variant="secondary" size="sm">Settings</Button>
                </div>
              </div>
            </header>

            {/* Filter tabs */}
            <div className="border-b border-stone-900 pb-3 flex gap-0 overflow-x-auto">
              {['All', 'Movies', 'TV Series', 'Books', 'Games'].map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className={`cursor-pointer min-h-11 px-4 py-2 text-sm font-mono border-b-2 -mb-px whitespace-nowrap transition-colors ${
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
              isOwner={true}
              userId="stress-user"
              currentUserNickname="stress-user"
              memberIds={ARCHIVE_MEMBERS.map((m) => m.id)}
              members={ARCHIVE_MEMBERS}
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
                  style={plan.highlight ? { backgroundColor: '#0b0b0f' } : {}}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 inset-x-0 h-0.5" style={{ backgroundColor: 'var(--color-accent)' }} />
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs " style={{ color: plan.highlight ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {plan.name}
                      </p>
                      {plan.popular && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border" style={{ borderColor: '#7a590066', color: 'var(--color-accent)' }}>
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-5xl text-stone-100 font-light">{plan.price}</span>
                      <span className="font-mono text-xs" style={{ color: '#52525b' }}>/ {plan.period}</span>
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
                  <div key={p} className="p-4 text-center border-l border-stone-800/50" style={i === 1 ? { backgroundColor: '#0b0b0f' } : {}}>
                    <p className="font-mono text-xs " style={{ color: i === 1 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{p}</p>
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
                    <div key={col} className="px-4 py-3.5 flex items-center justify-center border-l border-stone-800/30" style={col === 2 ? { backgroundColor: '#0b0b0f' } : {}}>
                      {typeof row[col] === 'boolean' ? (
                        row[col] ? (
                          <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <Minus className="h-4 w-4" style={{ color: '#3f3f46' }} />
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
              <p className="font-mono text-xs text-stone-600">Dashboard</p>
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
              <p className="font-mono text-xs text-stone-600">Group detail</p>
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
        {show('archive') && (
          <section className="space-y-6">
            <SectionHeading>Group archive — list, covers and stats views, with real artwork</SectionHeading>
            <GroupMediaSection
              groupId="stress-group"
              userId={ARCHIVE_MEMBERS[0].id}
              currentUserNickname={ARCHIVE_MEMBERS[0].nickname}
              isMember
              isOwner
              memberIds={ARCHIVE_MEMBERS.map((m) => m.id)}
              members={ARCHIVE_MEMBERS}
              notInterestedByItem={ARCHIVE_OPT_OUTS}
              initialItems={buildArchiveItems()}
              initialConsumedSet={new Set(['arch-1', 'arch-3', 'arch-6'])}
              initialActiveType="all"
              initialPage={1}
              initialView={params.view === 'grid' || params.view === 'stats' ? params.view : 'list'}
            />
          </section>
        )}

        {show('media-table') && (
          <section className="space-y-6">
            <SectionHeading>Media table — {mediaItems.length} items, all types, member view</SectionHeading>
            <MediaTable
              items={mediaItems}
              consumedSet={consumedSet}
              activeType="all"
              isMember={true}
              isOwner={true}
              userId="stress-user"
              currentUserNickname="stress-user"
              memberIds={ARCHIVE_MEMBERS.map((m) => m.id)}
              members={ARCHIVE_MEMBERS}
            />

            <SectionHeading>Media table — read-only (non-member)</SectionHeading>
            <MediaTable
              items={mediaItems.slice(0, 10)}
              consumedSet={new Set()}
              activeType="all"
              isMember={false}
              isOwner={false}
              userId="stress-user"
              currentUserNickname={null}
              memberIds={ARCHIVE_MEMBERS.map((m) => m.id)}
              members={ARCHIVE_MEMBERS}
            />

            <SectionHeading>Media table — empty state</SectionHeading>
            <MediaTable
              items={[]}
              consumedSet={new Set()}
              activeType="all"
              isMember={true}
              isOwner={true}
              userId="stress-user"
              currentUserNickname="stress-user"
              memberIds={ARCHIVE_MEMBERS.map((m) => m.id)}
              members={ARCHIVE_MEMBERS}
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
                <p className="font-mono text-xs " style={{ color: '#d69b0099' }}>Your profile</p>
                <h2 className="font-serif text-5xl text-stone-100 font-light">stress_user</h2>
                <p className="font-mono text-xs" style={{ color: '#52525b' }}>Member since 1 January 2025</p>
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
                    <p className="font-mono text-[10px]" style={{ color: '#52525b' }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Group list */}
              <div className="space-y-4">
                <p className="font-mono text-xs " style={{ color: '#52525b' }}>
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
                          <p className="text-sm font-light line-clamp-1" style={{ color: '#52525b' }}>{g.description}</p>
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          <p className="font-mono text-xs" style={{ color: '#52525b' }}>{g.itemCount} items</p>
                          <p className="font-mono text-[10px]" style={{ color: 'var(--color-accent)' }}>owner</p>
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
                <h3 className="font-mono text-xs " style={{ color: '#52525b' }}>Group info</h3>
                <div className="space-y-2">
                  <label className="font-mono text-xs text-stone-500">Name</label>
                  <div className="h-11 border border-stone-700 px-3 flex items-center">
                    <span className="text-stone-300 text-sm">{groups[0]?.name ?? 'Cinema Crew'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-xs text-stone-500">Description</label>
                  <div className="h-24 border border-stone-700 px-3 py-2">
                    <span className="text-stone-300 text-sm font-light">{groups[0]?.description ?? 'Group description...'}</span>
                  </div>
                </div>
                <Button size="sm">Save changes</Button>
              </div>

              {/* Members */}
              <div className="space-y-4">
                <h3 className="font-mono text-xs " style={{ color: '#52525b' }}>Members</h3>
                <div className="border border-stone-800/50">
                  {Array.from({ length: Math.min(5, Math.max(1, groups.length)) }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800/30 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-stone-200">user{i + 1}</span>
                        <span className="font-mono text-[10px] " style={{ color: i === 0 ? 'var(--color-accent)' : '#52525b' }}>
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
                  <h3 className="font-mono text-xs " style={{ color: '#e5484d' }}>Danger zone</h3>
                </div>
                <div className="border p-5 space-y-4" style={{ borderColor: '#b3272b4c', backgroundColor: '#b3272b26' }}>
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
      <h2 className="font-mono text-xs text-stone-500">{children}</h2>
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
      external_id: i % 3 === 0 ? `tmdb:movie:${1000 + i}` : null,
      external_source: i % 3 === 0 ? 'tmdb' : null,
      external_url: i % 3 === 0 ? `https://www.themoviedb.org/movie/${1000 + i}` : null,
      // No artwork in the stress fixtures: the point here is the layout with
      // the poster tile at its FALLBACK size, which is the case that has to
      // stay aligned. Real artwork only ever fills the same box.
      image_url: null,
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
  return (['plan_to_consume', 'consuming', 'completed', 'not_interested'] as ItemStatus[])[i % 4];
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

// ── Archive fixture ────────────────────────────────────────────────────────
// Real cover art (Open Library, one of the three allowed provider hosts) so the
// artwork-led views can be judged on actual images rather than empty frames.

const ARCHIVE_MEMBERS = [
  { id: 'stress-user', nickname: 'you' },
  { id: 'member-2', nickname: 'maya' },
  { id: 'member-3', nickname: 'theo' },
  { id: 'member-4', nickname: 'ines' },
  { id: 'member-5', nickname: 'bruno' },
];

const ARCHIVE_OPT_OUTS: Record<string, string[]> = {
  'arch-4': ['member-3'],
  'arch-7': ['member-2', 'member-5'],
};

const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

const ARCHIVE_SEED: Array<{
  id: string;
  title: string;
  type: MediaType;
  status: ItemStatus;
  credit: string;
  year: number;
  isbn: string;
  tags: string;
  finishedBy: string[];
  daysAgo: number;
}> = [
  { id: 'arch-1', title: 'The Hobbit', type: 'book', status: 'completed', credit: 'J.R.R. Tolkien', year: 1937, isbn: '9780547928227', tags: 'fantasy, comfort read', finishedBy: ['stress-user', 'member-2', 'member-3'], daysAgo: 4 },
  { id: 'arch-2', title: 'Nineteen Eighty-Four', type: 'book', status: 'consuming', credit: 'George Orwell', year: 1949, isbn: '9780451524935', tags: 'dystopia', finishedBy: ['member-2'], daysAgo: 12 },
  { id: 'arch-3', title: 'Dune', type: 'book', status: 'completed', credit: 'Frank Herbert', year: 1965, isbn: '9780441172719', tags: 'sci-fi, very long', finishedBy: ['stress-user', 'member-2', 'member-3', 'member-4', 'member-5'], daysAgo: 40 },
  { id: 'arch-4', title: 'Neuromancer', type: 'book', status: 'plan_to_consume', credit: 'William Gibson', year: 1984, isbn: '9780441569595', tags: 'cyberpunk', finishedBy: ['member-4'], daysAgo: 66 },
  { id: 'arch-5', title: 'Piranesi', type: 'book', status: 'plan_to_consume', credit: 'Susanna Clarke', year: 2020, isbn: '9781635575637', tags: 'strange, short', finishedBy: ['member-2', 'member-4'], daysAgo: 9 },
  { id: 'arch-6', title: 'Project Hail Mary', type: 'book', status: 'completed', credit: 'Andy Weir', year: 2021, isbn: '9780593135204', tags: 'space', finishedBy: ['stress-user', 'member-5'], daysAgo: 95 },
  { id: 'arch-7', title: 'The Catcher in the Rye', type: 'book', status: 'not_interested', credit: 'J.D. Salinger', year: 1951, isbn: '9780316769488', tags: 'classic', finishedBy: ['member-3'], daysAgo: 150 },
  { id: 'arch-8', title: 'The Goldfinch', type: 'book', status: 'consuming', credit: 'Donna Tartt', year: 2013, isbn: '9780385534260', tags: 'long, slow burn', finishedBy: [], daysAgo: 200 },
];

function buildArchiveItems(): MediaItemWithDetails[] {
  return ARCHIVE_SEED.map((seed) => ({
    id: seed.id,
    group_id: 'stress-group',
    title: seed.title,
    type: seed.type,
    status: seed.status,
    genre: seed.tags,
    metadata: { author: seed.credit, publication_year: seed.year },
    external_id: null,
    external_source: null,
    external_url: null,
    image_url: cover(seed.isbn),
    added_by: 'member-2',
    created_at: new Date(Date.now() - seed.daysAgo * 86400000).toISOString(),
    updated_at: new Date(Date.now() - seed.daysAgo * 86400000).toISOString(),
    added_by_profile: { nickname: 'maya' },
    consumption_records: seed.finishedBy.map((userId, index) => ({
      id: `${seed.id}-c${index}`,
      media_item_id: seed.id,
      user_id: userId,
      consumed_at: new Date(Date.now() - seed.daysAgo * 43200000).toISOString(),
      note: null,
      created_at: new Date(Date.now() - seed.daysAgo * 43200000).toISOString(),
      updated_at: new Date(Date.now() - seed.daysAgo * 43200000).toISOString(),
      profile: { nickname: ARCHIVE_MEMBERS.find((m) => m.id === userId)?.nickname ?? 'member' },
    })),
  }));
}


/** The covers the mock groups wear, rotated out of the archive seed so the
 *  dashboard and discover cards are judged against real artwork. */
function mockCovers(seed: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    cover(ARCHIVE_SEED[(seed + i) % ARCHIVE_SEED.length].isbn),
  );
}

function mockTypeCounts(seed: number, total: number): Record<MediaType, number> {
  const weights = [3, 2, 2, 1];
  const order: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = { movie: 0, tv_series: 0, book: 0, video_game: 0 } as Record<MediaType, number>;
  order.forEach((_, i) => {
    counts[order[(i + seed) % order.length]] = Math.round((weights[i] / sum) * total);
  });
  return counts;
}

type MockGroup = ReturnType<typeof buildGroups>[number];

function buildDashboardProps(groups: MockGroup[]) {
  const rows = groups.map((group, i) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    visibility: group.visibility as 'public' | 'private',
    owner_id: 'stress-user',
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    updated_at: new Date(Date.now() - i * 86400000).toISOString(),
    role: (i % 3 === 0 ? 'owner' : 'member') as 'owner' | 'member',
    itemCount: group.itemCount,
    memberCount: group.memberCount,
    typeCounts: mockTypeCounts(i, group.itemCount),
    covers: group.itemCount > 0 ? mockCovers(i, Math.min(5, group.itemCount)) : [],
  }));
  const totalItems = rows.reduce((sum, row) => sum + row.itemCount, 0);
  const typeCounts = rows.reduce(
    (acc, row) => {
      (Object.keys(acc) as MediaType[]).forEach((type) => {
        acc[type] += row.typeCounts[type];
      });
      return acc;
    },
    { movie: 0, tv_series: 0, book: 0, video_game: 0 } as Record<MediaType, number>,
  );

  return {
    groups: rows,
    ownedCount: rows.filter((row) => row.role === 'owner').length,
    atLimit: false,
    plan: 'free',
    maxOwned: 2,
    totalItems,
    consumedCount: Math.round(totalItems * 0.38),
    addedCount: Math.round(totalItems * 0.22),
    typeCounts,
    statusCounts: {
      completed: Math.round(totalItems * 0.38),
      consuming: Math.round(totalItems * 0.12),
      plan_to_consume: Math.round(totalItems * 0.44),
      not_interested: Math.round(totalItems * 0.06),
    } as Record<ItemStatus, number>,
    recentItems: ARCHIVE_SEED.slice(0, 6).map((seed, i) => ({
      id: seed.id,
      title: seed.title,
      type: seed.type,
      groupId: rows[i % Math.max(1, rows.length)]?.id ?? 'group-1',
      groupName: rows[i % Math.max(1, rows.length)]?.name ?? 'Group',
      createdAt: new Date(Date.now() - seed.daysAgo * 86400000).toISOString(),
      imageUrl: cover(seed.isbn),
    })),
  };
}

function buildDiscoverGroups(groups: MockGroup[]) {
  return groups
    .filter((group) => group.visibility === 'public')
    .map((group, i) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      owner_id: `owner-${i}`,
      ownerNickname: ['maya', 'theo', 'ines', 'bruno'][i % 4],
      memberCount: group.memberCount,
      itemCount: group.itemCount,
      isMember: i % 3 === 0,
      requestStatus: (i % 5 === 1 ? 'pending' : null) as 'pending' | null,
      typeCounts: mockTypeCounts(i, group.itemCount),
      covers: group.itemCount > 0 ? mockCovers(i + 2, Math.min(5, group.itemCount)) : [],
    }));
}
