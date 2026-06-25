// ============================================
// External provider router.
// One entry point — searchExternal() — routes each MediaType to the right
// provider adapter and returns a unified ExternalWork[] (the single internal
// abstraction the rest of the app speaks).
// ============================================

import type { ExternalWork, MediaType } from '@/types';
import { searchTmdb } from './tmdb';
import { searchOpenLibrary } from './openlibrary';
import { searchRawg } from './rawg';

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
  if (trimmed.length < 2) return [];

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
