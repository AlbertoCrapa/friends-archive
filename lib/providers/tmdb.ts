// ============================================
// TMDB adapter — movies and TV series
// Server-only. Normalizes TMDB search results into ExternalWork[].
// ============================================

import type { ExternalWork, ItemStory, MovieMetadata, TvSeriesMetadata } from '@/types';
import { ITEM_STORY_VERSION } from '@/types';
import { peopleMetadata } from '@/lib/utils';
import { fetchJson } from './http';
import type { ExternalDetails } from './types';
import { genreFromNames } from './types';
import {
  STORY_REVALIDATE_SECONDS,
  billedNames,
  factList,
  languageName,
  longDate,
  plainText,
  trimSynopsis,
} from './story';

// TMDB serves every poster at a set of fixed widths, chosen in the path. We keep
// two: a tiny one for the suggestion row, and the one we STORE — sized for the
// list thumbnails the app actually renders. A bigger surface later only needs
// the width swapped in the stored URL (w185 -> w500), no re-fetch.
const THUMB_BASE = 'https://image.tmdb.org/t/p/w92';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

interface TmdbMovieResult {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
}

interface TmdbTvResult {
  id: number;
  name?: string;
  first_air_date?: string;
  poster_path?: string | null;
}

interface TmdbResponse<T> {
  results?: T[];
}

function yearFrom(date?: string): number | undefined {
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

function imageFrom(path: string | null | undefined, base: string): string | undefined {
  return path ? `${base}${path}` : undefined;
}

/**
 * Search TMDB for movies or TV series. `kind` selects the endpoint and the
 * resulting MediaType. Returns [] on any error or missing key.
 */
export async function searchTmdb(
  kind: 'movie' | 'tv_series',
  query: string
): Promise<ExternalWork[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  // TMDB has two credential styles:
  //  - v3 key (short hex)      → passed as ?api_key=
  //  - v4 read token (a JWT)   → passed as Authorization: Bearer
  const isV4Token = apiKey.includes('.');
  const endpoint = kind === 'movie' ? 'movie' : 'tv';
  const base =
    `https://api.themoviedb.org/3/search/${endpoint}` +
    `?include_adult=false&page=1&query=${encodeURIComponent(query)}`;
  const url = isV4Token ? base : `${base}&api_key=${apiKey}`;
  const headers = isV4Token ? { Authorization: `Bearer ${apiKey}` } : undefined;

  if (kind === 'movie') {
    const data = await fetchJson<TmdbResponse<TmdbMovieResult>>(url, headers);
    return (data?.results ?? []).slice(0, 8).map((r) => {
      const year = yearFrom(r.release_date);
      return {
        external_id: `tmdb:movie:${r.id}`,
        external_source: 'tmdb',
        external_url: `https://www.themoviedb.org/movie/${r.id}`,
        type: 'movie',
        title: r.title ?? 'Untitled',
        year,
        subtitle: year ? String(year) : undefined,
        image_url: imageFrom(r.poster_path, POSTER_BASE),
        thumb_url: imageFrom(r.poster_path, THUMB_BASE),
        metadata: year ? { release_year: year } : {},
      } satisfies ExternalWork;
    });
  }

  const data = await fetchJson<TmdbResponse<TmdbTvResult>>(url, headers);
  return (data?.results ?? []).slice(0, 8).map((r) => {
    const year = yearFrom(r.first_air_date);
    return {
      external_id: `tmdb:tv:${r.id}`,
      external_source: 'tmdb',
      external_url: `https://www.themoviedb.org/tv/${r.id}`,
      type: 'tv_series',
      title: r.name ?? 'Untitled',
      year,
      subtitle: year ? String(year) : undefined,
      image_url: imageFrom(r.poster_path, POSTER_BASE),
      thumb_url: imageFrom(r.poster_path, THUMB_BASE),
      metadata: year ? { release_year: year } : {},
    } satisfies ExternalWork;
  });
}

// ── Detail lookup (richer metadata than search can return) ───────────────────

interface TmdbMovieDetails {
  runtime?: number | null;
  release_date?: string;
  poster_path?: string | null;
  genres?: Array<{ name?: string }>;
  credits?: { crew?: Array<{ job?: string; name?: string; id?: number }> };
}

interface TmdbTvDetails {
  first_air_date?: string;
  number_of_seasons?: number;
  poster_path?: string | null;
  genres?: Array<{ name?: string }>;
  created_by?: Array<{ name?: string; id?: number }>;
  networks?: Array<{ name?: string }>;
}

function buildTmdbUrl(path: string): { url: string; headers?: Record<string, string> } {
  const apiKey = process.env.TMDB_API_KEY!;
  const isV4Token = apiKey.includes('.');
  const base = `https://api.themoviedb.org/3/${path}`;
  return {
    url: isV4Token ? base : `${base}${base.includes('?') ? '&' : '?'}api_key=${apiKey}`,
    headers: isV4Token ? { Authorization: `Bearer ${apiKey}` } : undefined,
  };
}

/** Map a TMDB person (crew member / creator) to a name + their profile page. */
function tmdbPerson(person: { name?: string; id?: number }) {
  return {
    name: person.name,
    url: person.id ? `https://www.themoviedb.org/person/${person.id}` : undefined,
  };
}

/**
 * Fetch full metadata for one TMDB title so fields the search list omits
 * (director(s) + runtime for movies; creator(s)/seasons/platform for TV) can be
 * auto-filled. Co-directed films and multi-creator shows keep every credited
 * name. Returns null on any failure.
 */
export async function getTmdbDetails(
  kind: 'movie' | 'tv_series',
  id: string
): Promise<ExternalDetails | null> {
  if (!process.env.TMDB_API_KEY) return null;

  if (kind === 'movie') {
    const { url, headers } = buildTmdbUrl(`movie/${id}?append_to_response=credits`);
    const d = await fetchJson<TmdbMovieDetails>(url, headers);
    if (!d) return null;
    // A film can be co-directed (the Coens, the Wachowskis…) — keep them all.
    const directors = (d.credits?.crew ?? [])
      .filter((c) => c.job === 'Director')
      .map(tmdbPerson);
    const year = yearFrom(d.release_date);
    const metadata: MovieMetadata = {
      ...peopleMetadata('director', directors),
      ...(year ? { release_year: year } : {}),
      ...(d.runtime ? { duration_minutes: d.runtime } : {}),
    };
    return {
      metadata,
      genre: genreFromNames((d.genres ?? []).map((g) => g.name)),
      image_url: imageFrom(d.poster_path, POSTER_BASE),
    };
  }

  const { url, headers } = buildTmdbUrl(`tv/${id}`);
  const d = await fetchJson<TmdbTvDetails>(url, headers);
  if (!d) return null;
  const creators = (d.created_by ?? []).map(tmdbPerson);
  const platform = d.networks?.[0]?.name;
  const year = yearFrom(d.first_air_date);
  const metadata: TvSeriesMetadata = {
    ...peopleMetadata('creator', creators),
    ...(year ? { release_year: year } : {}),
    ...(d.number_of_seasons ? { seasons: d.number_of_seasons } : {}),
    ...(platform ? { platform } : {}),
  };
  return {
    metadata,
    genre: genreFromNames((d.genres ?? []).map((g) => g.name)),
    image_url: imageFrom(d.poster_path, POSTER_BASE),
  };
}

// ── Story (the on-demand read behind the item sheet) ─────────────────────────

interface TmdbCredits {
  cast?: Array<{ name?: string; order?: number }>;
}

interface TmdbMovieStory {
  overview?: string;
  tagline?: string;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  original_language?: string;
  revenue?: number;
  production_companies?: Array<{ name?: string }>;
  credits?: TmdbCredits;
}

interface TmdbTvStory {
  overview?: string;
  tagline?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  /** Effectively always empty now — see episodeLength(). */
  episode_run_time?: number[];
  vote_average?: number;
  vote_count?: number;
  first_air_date?: string;
  last_air_date?: string;
  status?: string;
  original_language?: string;
  networks?: Array<{ name?: string }>;
  credits?: TmdbCredits;
  last_episode_to_air?: { runtime?: number | null } | null;
  /** The appended first season. The key really is spelled "season/1". */
  'season/1'?: { episodes?: Array<{ runtime?: number | null }> };
}

/**
 * How long ONE episode of this show runs.
 *
 * `episode_run_time` is the field for this and TMDB has quietly emptied it —
 * it comes back `[]` for Breaking Bad, Game of Thrones, Arcane and everything
 * else we tried. So the length is taken from the MEDIAN of the first season's
 * episodes, which is why the story appends `season/1` to the same request
 * rather than spending a second one.
 *
 * The median, not the last episode: a finale is the outlier of its own show
 * (Friends ends on a 48-minute double, against a 23-minute median), and
 * multiplying a finale by the episode count overstated Friends by 95 hours.
 */
function episodeLength(d: TmdbTvStory): number | undefined {
  const runtimes = (d['season/1']?.episodes ?? [])
    .map((episode) => episode.runtime)
    .filter((n): n is number => typeof n === 'number' && n > 0)
    .sort((a, b) => a - b);
  if (runtimes.length > 0) return runtimes[Math.floor(runtimes.length / 2)];

  const declared = (d.episode_run_time ?? []).filter((n) => n > 0).sort((a, b) => a - b);
  if (declared.length > 0) return declared[0];

  const last = d.last_episode_to_air?.runtime;
  return typeof last === 'number' && last > 0 ? last : undefined;
}

/** $1,300,000,000 -> "$1.3B". Only worth showing at all above a million. */
function money(value: unknown): string | undefined {
  if (typeof value !== 'number' || value < 1_000_000) return undefined;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  return `$${Math.round(value / 1_000_000)}M`;
}

/** TMDB bills its cast in `order`; take the top of that list, not the API's. */
function topBilled(credits: TmdbCredits | undefined) {
  return [...(credits?.cast ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 6);
}

/**
 * The full story for one TMDB title: synopsis, the world's score, the billed
 * cast, and the time it asks of you.
 *
 * A series' time cost is the honest one — episodes times their length, not the
 * length of one episode — because that is the number a group is really
 * deciding about when somebody proposes starting a show.
 */
export async function getTmdbStory(
  kind: 'movie' | 'tv_series',
  id: string
): Promise<ItemStory | null> {
  if (!process.env.TMDB_API_KEY) return null;
  const fetchedAt = new Date().toISOString();

  if (kind === 'movie') {
    const { url, headers } = buildTmdbUrl(`movie/${id}?append_to_response=credits`);
    const d = await fetchJson<TmdbMovieStory>(url, headers, undefined, STORY_REVALIDATE_SECONDS);
    if (!d) return null;
    const runtime = typeof d.runtime === 'number' && d.runtime > 0 ? d.runtime : undefined;
    return {
      v: ITEM_STORY_VERSION,
      source: 'tmdb',
      fetched_at: fetchedAt,
      synopsis: trimSynopsis(d.overview),
      tagline: plainText(d.tagline),
      ...(runtime ? { minutes: runtime, minutes_basis: 'Runtime' } : {}),
      ...(d.vote_average && d.vote_average > 0
        ? { score: { value: d.vote_average, count: d.vote_count, label: 'TMDB members' } }
        : {}),
      people: billedNames(topBilled(d.credits)),
      facts: factList([
        { label: 'Released', value: longDate(d.release_date) },
        { label: 'Language', value: languageName(d.original_language) },
        { label: 'Studio', value: d.production_companies?.[0]?.name },
        { label: 'Box office', value: money(d.revenue) },
      ]),
    };
  }

  const { url, headers } = buildTmdbUrl(`tv/${id}?append_to_response=credits,season/1`);
  const d = await fetchJson<TmdbTvStory>(url, headers, undefined, STORY_REVALIDATE_SECONDS);
  if (!d) return null;

  const episodes = d.number_of_episodes ?? 0;
  const perEpisode = episodeLength(d);
  const minutes = episodes > 0 && perEpisode ? episodes * perEpisode : undefined;

  return {
    v: ITEM_STORY_VERSION,
    source: 'tmdb',
    fetched_at: fetchedAt,
    synopsis: trimSynopsis(d.overview),
    tagline: plainText(d.tagline),
    ...(minutes
      ? { minutes, minutes_basis: `${episodes} episodes × ${perEpisode} min` }
      : {}),
    ...(d.vote_average && d.vote_average > 0
      ? { score: { value: d.vote_average, count: d.vote_count, label: 'TMDB members' } }
      : {}),
    people: billedNames(topBilled(d.credits)),
    facts: factList([
      { label: 'Status', value: d.status },
      { label: 'First aired', value: longDate(d.first_air_date) },
      { label: 'Last aired', value: longDate(d.last_air_date) },
      { label: 'Network', value: d.networks?.[0]?.name },
      { label: 'Language', value: languageName(d.original_language) },
    ]),
  };
}
