// ============================================
// External provider router.
// One entry point — searchExternal() — routes each MediaType to the right
// provider adapter and returns a unified ExternalWork[] (the single internal
// abstraction the rest of the app speaks).
// ============================================

import type { ExternalWork, MediaType } from '@/types';
import { searchTmdb, getTmdbDetails } from './tmdb';
import { searchOpenLibrary } from './openlibrary';
import { searchRawg, getRawgDetails } from './rawg';
import type { ExternalDetails } from './types';

/** Provider assignment per media category. */
export const PROVIDER_FOR_TYPE: Record<MediaType, 'tmdb' | 'openlibrary' | 'rawg'> = {
  movie: 'tmdb',
  tv_series: 'tmdb',
  book: 'openlibrary',
  video_game: 'rawg',
};

/**
 * Search the appropriate external provider for a media type.
 * Always resolves (never throws): on any provider failure it returns [], so the
 * UI cleanly falls back to manual entry.
 */
export async function searchExternal(
  type: MediaType,
  query: string
): Promise<ExternalWork[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  switch (type) {
    case 'movie':
      return searchTmdb('movie', trimmed);
    case 'tv_series':
      return searchTmdb('tv_series', trimmed);
    case 'book':
      return searchOpenLibrary(trimmed);
    case 'video_game':
      return searchRawg(trimmed);
    default:
      return [];
  }
}

/**
 * Fetch full metadata (and a genre hint) for a single work by its namespaced
 * external_id, to auto-fill fields the search list can't return (director/runtime
 * for movies, developer for games, creator/seasons/platform for TV, plus genre).
 * Books are already fully covered by search, so they need no detail call.
 * Returns null on any failure.
 */
export async function getExternalDetails(
  externalId: string
): Promise<ExternalDetails | null> {
  const [source, kind, ...rest] = externalId.split(':');
  const id = rest.join(':');
  if (!id) return null;

  if (source === 'tmdb' && kind === 'movie') return getTmdbDetails('movie', id);
  if (source === 'tmdb' && kind === 'tv') return getTmdbDetails('tv_series', id);
  if (source === 'rawg' && kind === 'game') return getRawgDetails(id);
  return null;
}
