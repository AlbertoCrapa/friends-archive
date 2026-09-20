// ============================================
// External provider router.
// One entry point — searchExternal() — routes each MediaType to the right
// provider adapter and returns a unified ExternalWork[] (the single internal
// abstraction the rest of the app speaks).
// ============================================

import type { ExternalWork, ItemStory, MediaType } from '@/types';
import { searchTmdb, getTmdbDetails, getTmdbStory } from './tmdb';
import { searchOpenLibrary, getOpenLibraryDetails, getOpenLibraryStory } from './openlibrary';
import { searchRawg, getRawgDetails, getRawgStory } from './rawg';
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
 * Fetch full metadata (a genre hint and the artwork) for a single work by its
 * namespaced external_id, to auto-fill fields the search list can't return
 * (director/runtime for movies, developer for games, creator/seasons/platform
 * for TV, plus genre). Books get only their cover here — search already returns
 * everything else about them. Returns null on any failure.
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
  if (source === 'openlibrary' && kind === 'book') return getOpenLibraryDetails(id);
  return null;
}

/**
 * Read the STORY for one linked work — the synopsis, the world's score, the
 * billed names and the time it asks of you.
 *
 * Nothing here is written to our own row: the story is read when a member opens
 * the item and cached in front of this call (Next's shared fetch cache on the
 * server, the browser's memory and localStorage on the client), so a title
 * costs at most one provider call a day no matter how many friends open it.
 * See DATA_MODEL § 6.11. Returns null for manual items and on any failure —
 * the sheet simply shows what we already know about the item instead.
 */
export async function getExternalStory(externalId: string): Promise<ItemStory | null> {
  const [source, kind, ...rest] = externalId.split(':');
  const id = rest.join(':');
  if (!id) return null;

  if (source === 'tmdb' && kind === 'movie') return getTmdbStory('movie', id);
  if (source === 'tmdb' && kind === 'tv') return getTmdbStory('tv_series', id);
  if (source === 'rawg' && kind === 'game') return getRawgStory(id);
  if (source === 'openlibrary' && kind === 'book') return getOpenLibraryStory(id);
  return null;
}
