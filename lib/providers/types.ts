// ============================================================================
// Shared types/helpers for provider detail lookups.
// ============================================================================

import type { MediaMetadata } from '@/types';

/**
 * Result of a detail lookup: the normalized metadata plus an optional genre
 * hint (genre is a top-level media_items column, not part of the JSONB bag).
 */
export interface ExternalDetails {
  metadata: MediaMetadata;
  genre?: string;
}

/**
 * Build a clean, comma-separated tag string from a provider's names (genres +
 * any extra gameplay/keyword tags). De-duplicates case-insensitively, keeps up
 * to six, and caps the result to the media_items.genre 255-char limit. The
 * column is named `genre` for legacy reasons but stores the item's tag list.
 */
export function genreFromNames(names: Array<string | undefined>): string | undefined {
  const clean: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const value = name?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(value);
    if (clean.length >= 6) break;
  }
  if (clean.length === 0) return undefined;
  return clean.join(', ').slice(0, 255);
}
