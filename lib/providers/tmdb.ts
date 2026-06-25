// ============================================
// TMDB adapter — movies and TV series
// Server-only. Normalizes TMDB search results into ExternalWork[].
// ============================================

import type { ExternalWork, MovieMetadata, TvSeriesMetadata } from '@/types';
import { fetchJson } from './http';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

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

function imageFrom(path?: string | null): string | undefined {
  return path ? `${IMAGE_BASE}${path}` : undefined;
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
        image_url: imageFrom(r.poster_path),
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
      image_url: imageFrom(r.poster_path),
      metadata: year ? { release_year: year } : {},
    } satisfies ExternalWork;
  });
}

// ── Detail lookup (richer metadata than search can return) ───────────────────

interface TmdbMovieDetails {
  runtime?: number | null;
  release_date?: string;
  credits?: { crew?: Array<{ job?: string; name?: string; id?: number }> };
}

interface TmdbTvDetails {
  first_air_date?: string;
  number_of_seasons?: number;
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

/**
 * Fetch full metadata for one TMDB title so fields the search list omits
 * (director + runtime for movies; creator/seasons/platform for TV) can be
 * auto-filled. Returns null on any failure.
 */
export async function getTmdbDetails(
  kind: 'movie' | 'tv_series',
  id: string
): Promise<MovieMetadata | TvSeriesMetadata | null> {
  if (!process.env.TMDB_API_KEY) return null;

  if (kind === 'movie') {
    const { url, headers } = buildTmdbUrl(`movie/${id}?append_to_response=credits`);
    const d = await fetchJson<TmdbMovieDetails>(url, headers);
    if (!d) return null;
    const directorCrew = d.credits?.crew?.find((c) => c.job === 'Director');
    const director = directorCrew?.name;
    const year = yearFrom(d.release_date);
    return {
      ...(director ? { director } : {}),
      ...(director && directorCrew?.id
        ? { director_url: `https://www.themoviedb.org/person/${directorCrew.id}` }
        : {}),
      ...(year ? { release_year: year } : {}),
      ...(d.runtime ? { duration_minutes: d.runtime } : {}),
    } satisfies MovieMetadata;
  }

  const { url, headers } = buildTmdbUrl(`tv/${id}`);
  const d = await fetchJson<TmdbTvDetails>(url, headers);
  if (!d) return null;
  const creatorObj = d.created_by?.[0];
  const creator = creatorObj?.name;
  const platform = d.networks?.[0]?.name;
  const year = yearFrom(d.first_air_date);
  return {
    ...(creator ? { creator } : {}),
    ...(creator && creatorObj?.id
      ? { creator_url: `https://www.themoviedb.org/person/${creatorObj.id}` }
      : {}),
    ...(year ? { release_year: year } : {}),
    ...(d.number_of_seasons ? { seasons: d.number_of_seasons } : {}),
    ...(platform ? { platform } : {}),
  } satisfies TvSeriesMetadata;
}
