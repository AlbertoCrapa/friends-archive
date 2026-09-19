// ============================================
// RAWG adapter — video games
// Server-only. Normalizes RAWG /games search into ExternalWork[].
// ============================================

import type { ExternalWork, VideoGameMetadata } from '@/types';
import { peopleMetadata } from '@/lib/utils';
import { fetchJson } from './http';
import type { ExternalDetails } from './types';
import { genreFromNames } from './types';

interface RawgResult {
  id: number;
  slug?: string;
  name?: string;
  released?: string; // "YYYY-MM-DD"
  background_image?: string | null;
}

interface RawgResponse {
  results?: RawgResult[];
}

function yearFrom(date?: string): number | undefined {
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

// RAWG's key art is full-bleed (often 1920px wide) — far too heavy for a row of
// thumbnails. Its CDN resizes on the fly when a `resize/<width>/-/` segment is
// inserted after /media/, which is what rawg.io itself serves. Anything that
// doesn't match the expected shape is passed through untouched.
const RAWG_MEDIA_PREFIX = 'https://media.rawg.io/media/';

function rawgImage(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith(RAWG_MEDIA_PREFIX)) return url;
  return `${RAWG_MEDIA_PREFIX}resize/${width}/-/${url.slice(RAWG_MEDIA_PREFIX.length)}`;
}

export async function searchRawg(query: string): Promise<ExternalWork[]> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return [];

  const url =
    'https://api.rawg.io/api/games' +
    `?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=8`;

  const data = await fetchJson<RawgResponse>(url);

  return (data?.results ?? [])
    .map((r) => {
      if (!r.name) return null;
      const year = yearFrom(r.released);
      const slug = r.slug ?? String(r.id);
      return {
        external_id: `rawg:game:${r.id}`,
        external_source: 'rawg',
        external_url: `https://rawg.io/games/${slug}`,
        type: 'video_game',
        title: r.name,
        year,
        subtitle: year ? String(year) : undefined,
        image_url: rawgImage(r.background_image, 420),
        thumb_url: rawgImage(r.background_image, 200),
        metadata: year ? { release_year: year } : {},
      } satisfies ExternalWork;
    })
    .filter((work): work is NonNullable<typeof work> => work !== null);
}

// ── Detail lookup (developer/publisher/platforms not in the search list) ──────

interface RawgGameDetails {
  released?: string;
  background_image?: string | null;
  developers?: Array<{ name?: string; slug?: string }>;
  publishers?: Array<{ name?: string }>;
  platforms?: Array<{ platform?: { name?: string } }>;
  genres?: Array<{ name?: string }>;
  tags?: Array<{ name?: string; slug?: string }>;
}

/**
 * Gameplay/keyword RAWG tags worth surfacing as item tags — info that doesn't
 * fit the structured fields (co-op, anime, multiplayer…). Mapped from RAWG's
 * slug to a tidy label. Everything else in RAWG's huge, noisy tag list is ignored.
 */
const RAWG_TAG_LABELS: Record<string, string> = {
  'co-op': 'Co-op',
  'online-co-op': 'Online Co-op',
  'local-co-op': 'Local Co-op',
  'split-screen': 'Split Screen',
  multiplayer: 'Multiplayer',
  'online-multiplayer': 'Online Multiplayer',
  singleplayer: 'Singleplayer',
  pvp: 'PvP',
  'open-world': 'Open World',
  'story-rich': 'Story Rich',
  rpg: 'RPG',
  roguelike: 'Roguelike',
  'souls-like': 'Souls-like',
  anime: 'Anime',
  horror: 'Horror',
};

/** Pick up to three allow-listed gameplay tags from a RAWG tag list. */
function gameplayTags(tags: RawgGameDetails['tags']): string[] {
  const out: string[] = [];
  for (const tag of tags ?? []) {
    const label = tag.slug ? RAWG_TAG_LABELS[tag.slug] : undefined;
    if (label && !out.includes(label)) out.push(label);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Fetch full metadata for one RAWG game so the developer(s) (and publisher /
 * platforms / genre) can be auto-filled. Costs ONE extra RAWG call per selection
 * — acceptable because selections are rare and deliberate. Returns null on failure.
 */
export async function getRawgDetails(id: string): Promise<ExternalDetails | null> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return null;

  const d = await fetchJson<RawgGameDetails>(
    `https://api.rawg.io/api/games/${id}?key=${apiKey}`
  );
  if (!d) return null;

  // Co-developed games (studio + port house, sequel handoffs…) credit several.
  const developers = (d.developers ?? []).map((dev) => ({
    name: dev.name,
    url: dev.slug ? `https://rawg.io/developers/${dev.slug}` : undefined,
  }));
  const publisher = d.publishers?.[0]?.name;
  const year = yearFrom(d.released);
  const platforms = d.platforms
    ?.map((p) => p.platform?.name)
    .filter((name): name is string => !!name);

  const metadata: VideoGameMetadata = {
    ...peopleMetadata('developer', developers),
    ...(publisher ? { publisher } : {}),
    ...(year ? { release_year: year } : {}),
    ...(platforms && platforms.length ? { platforms } : {}),
  };
  // Tags = genres first (RPG, Action…) then a few gameplay tags (Co-op, Anime…).
  const tagNames = [
    ...(d.genres ?? []).map((g) => g.name),
    ...gameplayTags(d.tags),
  ];
  return {
    metadata,
    genre: genreFromNames(tagNames),
    image_url: rawgImage(d.background_image, 420),
  };
}
