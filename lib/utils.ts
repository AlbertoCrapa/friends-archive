import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx — the canonical way to compose class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO date string for display.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO date string as a relative time (e.g. "3 days ago").
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '…';
}

// ── Tags ──────────────────────────────────────────────────────────────────
// Tags are stored in the media_items.genre column as a comma-separated list
// (the column name is legacy; semantically it is the item's tag set). On top of
// the user/enrichment-supplied genre tags we surface a few stable metadata
// values (platform, publisher, people) as derived, filterable tags.

/** Max characters for the serialized tag list (matches the genre CHECK in the DB). */
export const TAGS_MAX_LENGTH = 255;

/** Metadata keys that also read nicely as filterable tags. */
const TAG_META_KEYS = ['platform', 'publisher', 'director', 'creator', 'author', 'developer'] as const;

/** Split the stored genre string into trimmed, de-duplicated tags (original case). */
export function parseTags(genre: string | null | undefined): string[] {
  if (!genre) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of genre.split(',')) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Join tags back into the comma-separated string stored in genre (length-capped). */
export function serializeTags(tags: string[]): string {
  return tags.join(', ').slice(0, TAGS_MAX_LENGTH);
}

/**
 * The full, normalized (UPPERCASE), de-duplicated tag set for an item — the
 * genre tags plus the derived metadata tags. Used for display chips and for
 * tag filtering, so what you see is exactly what you can filter by.
 */
export function getItemTags(item: { genre?: string | null; metadata?: unknown }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const key = value.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  for (const tag of parseTags(item.genre)) push(tag);

  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  for (const k of TAG_META_KEYS) {
    if (typeof meta[k] === 'string') push(meta[k] as string);
  }
  return out;
}

/**
 * Returns Tailwind colour classes for a given item status value.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    plan_to_consume: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    consuming: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    completed: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    // Legacy string values — kept for graceful degradation during migration
    'Plan to Watch': 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    Watching: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    Watched: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    'Plan to Read': 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    Reading: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    Read: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
  };
  return colors[status] ?? 'bg-stone-800/30 text-stone-400 border-stone-700/50';
}
