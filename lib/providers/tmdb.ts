// ============================================
// TMDB adapter — movies and TV series
// Server-only. Normalizes TMDB search results into ExternalWork[].
// ============================================

import type { ExternalWork } from '@/types';
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
