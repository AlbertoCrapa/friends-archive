import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MediaTable } from '@/components/features/media/MediaTable';
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';

interface Props {
  searchParams: Promise<{ scenario?: string }>;
}

type ScenarioKey = 'empty' | 'minimal' | 'typical' | 'dense' | 'overflow';

const scenarios: Array<{ key: ScenarioKey; label: string; count: number }> = [
  { key: 'empty', label: 'Empty', count: 0 },
  { key: 'minimal', label: 'Minimal', count: 2 },
  { key: 'typical', label: 'Typical', count: 20 },
  { key: 'dense', label: 'Dense', count: 100 },
  { key: 'overflow', label: 'Overflow', count: 140 },
];

export default async function UIStressPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeScenario = scenarios.find((scenario) => scenario.key === params.scenario)?.key ?? 'typical';
  const itemCount = scenarios.find((scenario) => scenario.key === activeScenario)?.count ?? 20;

  const mediaItems = buildMediaItems(itemCount);
  const consumedSet = new Set(
    mediaItems.filter((_, index) => index % 3 === 0).map((item) => item.id)
  );

  const groups = buildGroups(itemCount);

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Stress validation surface</p>
          <h1 className="font-serif text-3xl text-stone-100 sm:text-4xl">Protected UI Stress Preview</h1>
          <p className="max-w-3xl text-sm text-stone-400">
            This page injects mock data directly into protected-route component patterns to validate content density,
            truncation, spacing, and mobile interaction comfort at multiple volumes.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Scenario</h2>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((scenario) => {
              const selected = activeScenario === scenario.key;
              return (
                <Link key={scenario.key} href={`/ui-stress?scenario=${scenario.key}`}>
                  <Button variant={selected ? 'primary' : 'outline'} size="sm">
                    {scenario.label} ({scenario.count})
                  </Button>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Dashboard / Discover Card Density</h2>
          {groups.length === 0 ? (
            <div className="border border-stone-800/50 p-8 text-center text-stone-500">No groups in this scenario.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <article
                  key={group.id}
                  className="border border-stone-800/50 p-5 transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)] hover:border-amber-800/50 hover:bg-stone-900/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-serif text-lg text-stone-100">{group.name}</h3>
                    <Badge variant={group.visibility === 'public' ? 'public' : 'private'}>
                      {group.visibility === 'public' ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-stone-400">{group.description}</p>
                  <p className="mt-3 text-xs font-mono text-stone-500">{group.memberCount} members</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Profile List Density</h2>
          {groups.length === 0 ? (
            <div className="border border-stone-800/50 p-8 text-center text-stone-500">No profile groups in this scenario.</div>
          ) : (
            <div className="space-y-2">
              {groups.slice(0, Math.min(groups.length, 40)).map((group) => (
                <article key={`${group.id}-profile`} className="border border-stone-800/50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="line-clamp-1 font-serif text-stone-100">{group.name}</span>
                    <Badge variant={group.visibility === 'public' ? 'public' : 'private'}>
                      {group.visibility === 'public' ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-stone-500">{group.description}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Group Media List Density</h2>
          <MediaTable
            items={mediaItems}
            consumedSet={consumedSet}
            activeType="all"
            isMember={false}
            userId="stress-user"
            currentUserNickname="stress-user"
          />
        </section>
      </div>
    </main>
  );
}

function buildGroups(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const isLongName = index % 4 === 0;
    return {
      id: `group-${index + 1}`,
      name: isLongName
        ? `This is an intentionally very long group name number ${index + 1} to stress truncation and alignment stability in card and list patterns`
        : `Group ${index + 1}`,
      description:
        index % 5 === 0
          ? 'Tiny description.'
          : `Collaborative group description for item ${index + 1}. This sentence intentionally varies in length to validate wrapping behavior and line clamping across viewports.`,
      visibility: index % 2 === 0 ? 'public' : 'private',
      memberCount: Math.max(1, Math.floor((index + 2) * 1.7)),
    };
  });
}

function buildMediaItems(count: number): MediaItemWithDetails[] {
  return Array.from({ length: count }, (_, index) => {
    const type = mediaTypeFor(index);
    const status = statusFor(index);

    return {
      id: `media-${index + 1}`,
      group_id: 'stress-group',
      title:
        index % 6 === 0
          ? `Extremely long media title ${index + 1} used to test overflow, truncation, and card integrity with variable-length text content`
          : index % 7 === 0
            ? `X${index + 1}`
            : `Media Item ${index + 1}`,
      type,
      status,
      genre: index % 3 === 0 ? 'Drama, Mystery, Documentary, Science Fiction' : 'Action',
      metadata: metadataFor(type, index),
      added_by: `user-${(index % 12) + 1}`,
      created_at: new Date(Date.now() - index * 86400000).toISOString(),
      updated_at: new Date(Date.now() - index * 3600000).toISOString(),
      added_by_profile: {
        nickname: index % 5 === 0 ? `very_long_nickname_for_density_testing_${index + 1}` : `user${(index % 12) + 1}`,
      },
      consumption_records:
        index % 2 === 0
          ? [
              {
                id: `record-${index + 1}`,
                media_item_id: `media-${index + 1}`,
                user_id: 'stress-user',
                consumed_at: new Date(Date.now() - index * 7200000).toISOString(),
                note:
                  index % 8 === 0
                    ? 'Very long personal note for stress testing layout balance under dense textual metadata in the consumed by dialog and row rendering.'
                    : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                profile: {
                  nickname: index % 4 === 0 ? `nickname_with_length_extreme_${index + 1}` : `reader${index + 1}`,
                },
              },
            ]
          : [],
    };
  });
}

function mediaTypeFor(index: number): MediaType {
  const types: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];
  return types[index % types.length];
}

function statusFor(index: number): ItemStatus {
  const values: ItemStatus[] = ['plan_to_consume', 'consuming', 'completed'];
  return values[index % values.length];
}

function metadataFor(type: MediaType, index: number): Record<string, unknown> {
  if (type === 'movie') {
    return {
      director: index % 5 === 0 ? 'Long Director Name For Overflow Validation' : 'Director',
      release_year: 1990 + (index % 30),
      duration_minutes: 80 + (index % 90),
    };
  }
  if (type === 'tv_series') {
    return {
      creator: 'Creator Name',
      release_year: 1995 + (index % 25),
      seasons: 1 + (index % 10),
      platform: index % 3 === 0 ? 'VeryLongStreamingPlatformNameForTesting' : 'StreamNow',
    };
  }
  if (type === 'book') {
    return {
      author: index % 3 === 0 ? 'Author With Long Name Variant For Layout' : 'Author',
      publication_year: 1960 + (index % 60),
    };
  }
  return {
    developer: index % 2 === 0 ? 'Studio Name' : 'Very Long Developer Studio Name For Edge Testing',
    release_year: 1980 + (index % 40),
  };
}
