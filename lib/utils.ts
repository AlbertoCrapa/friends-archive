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

// ── People (director / creator / author / developer) ──────────────────────
// A work can credit several people. The names live in ONE comma-separated
// string under the existing singular metadata key (`director`, `author`, …) —
// so archive export/import, search and rows written before multi-person support
// all keep working unchanged — and the matching `<key>_urls` array carries one
// external page per name, positionally aligned ('' when that person has none).
// The legacy singular `<key>_url` is still read as the first name's page.

/** Metadata keys holding credited people/companies. */
export const PERSON_KEYS = ['director', 'creator', 'author', 'developer'] as const;

export type PersonKey = (typeof PERSON_KEYS)[number];

/** Max people kept per role — keeps the summary line and the tag set readable. */
export const MAX_PEOPLE = 3;

/** One credited person: their name plus, when known, their external page. */
export interface CreditedPerson {
  name: string;
  url?: string;
}

/**
 * Split a comma-separated people string into trimmed names. De-duplicates
 * case-insensitively and keeps at most MAX_PEOPLE.
 */
export function parsePeople(value: string | null | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(',')) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_PEOPLE) break;
  }
  return out;
}

/** Only http(s) links are ever rendered — metadata is a free-form JSONB bag. */
function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

/** The people credited for one role, in stored order, with their links. */
export function getPeople(metadata: unknown, key: PersonKey): CreditedPerson[] {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const names = parsePeople(typeof meta[key] === 'string' ? (meta[key] as string) : '');
  const urls = Array.isArray(meta[`${key}_urls`]) ? (meta[`${key}_urls`] as unknown[]) : [];
  const legacyUrl = safeUrl(meta[`${key}_url`]);

  return names.map((name, index) => {
    const url = safeUrl(urls[index]) ?? (index === 0 ? legacyUrl : undefined);
    return url ? { name, url } : { name };
  });
}

/**
 * Build the stored metadata fields for one role. `linkFor` resolves a name to
 * its external page, so renaming a person drops their link instead of leaving
 * it pointing at somebody else. Returns {} when there are no names.
 */
export function peopleFields(
  key: PersonKey,
  names: string[],
  linkFor: (name: string) => string | undefined
): Record<string, unknown> {
  const clean = parsePeople(names.join(', '));
  if (clean.length === 0) return {};
  const urls = clean.map((name) => linkFor(name) ?? '');
  return {
    [key]: clean.join(', '),
    ...(urls.some(Boolean) ? { [`${key}_urls`]: urls } : {}),
  };
}

/** The names for one role as a single text-field value ("Joel Coen, Ethan Coen"). */
export function peopleValue(metadata: unknown, key: PersonKey): string {
  return getPeople(metadata, key)
    .map((person) => person.name)
    .join(', ');
}

/**
 * Every known person page in a metadata bag, keyed by lowercased name — the
 * lookup the add/edit forms hold on to while their people fields are free text.
 */
export function personLinksFrom(metadata: unknown): Record<string, string> {
  const links: Record<string, string> = {};
  for (const key of PERSON_KEYS) {
    for (const person of getPeople(metadata, key)) {
      if (person.url) links[person.name.toLowerCase()] = person.url;
    }
  }
  return links;
}

/** Same as peopleFields(), for the {name, url} lists provider adapters build. */
export function peopleMetadata(
  key: PersonKey,
  people: Array<{ name?: string | null; url?: string }>
): Record<string, unknown> {
  const names: string[] = [];
  const links: Record<string, string> = {};
  for (const person of people) {
    const name = person.name?.trim();
    if (!name) continue;
    names.push(name);
    const url = safeUrl(person.url);
    if (url && !links[name.toLowerCase()]) links[name.toLowerCase()] = url;
  }
  return peopleFields(key, names, (name) => links[name.toLowerCase()]);
}

// ── Artwork ───────────────────────────────────────────────────────────────
// An item's poster/cover is stored as a LINK to the provider's CDN — we never
// copy the bytes into Supabase Storage (see DATA_MODEL § 6.10). Because any
// group member can write media_items.image_url, the value is restricted to the
// image hosts of the three providers we already trust: an arbitrary URL in an
// <img src> would turn every viewer of the group into a request to a stranger's
// server. The same rule is enforced in the database by a CHECK constraint.

/** Image CDNs we accept artwork from — one per provider. */
export const PROVIDER_IMAGE_HOSTS = [
  'image.tmdb.org',
  'covers.openlibrary.org',
  'media.rawg.io',
] as const;

/** Max characters for a stored artwork URL (mirrors the DB CHECK). */
export const IMAGE_URL_MAX_LENGTH = 500;

/**
 * Normalize an artwork URL for storage/rendering: https, from a provider image
 * host, within the length cap. Returns null for anything else, so a bad value
 * degrades to "no artwork" instead of loading a stranger's URL.
 */
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > IMAGE_URL_MAX_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    if (!PROVIDER_IMAGE_HOSTS.includes(url.hostname as (typeof PROVIDER_IMAGE_HOSTS)[number])) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

// ── Tags ──────────────────────────────────────────────────────────────────
// Tags are stored in the media_items.genre column as a comma-separated list
// (the column name is legacy; semantically it is the item's tag set). On top of
// the user/enrichment-supplied genre tags we surface a few stable metadata
// values (platform, publisher) as derived, filterable tags.

/** Max characters for the serialized tag list (matches the genre CHECK in the DB). */
export const TAGS_MAX_LENGTH = 255;

/** Metadata keys that also read nicely as visible, filterable tags. */
const TAG_META_KEYS = ['platform', 'publisher'] as const;

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

type TaggableItem = { genre?: string | null; metadata?: unknown };

/** Collects normalized (UPPERCASE), de-duplicated tags in insertion order. */
function collectTags(item: TaggableItem, includePeople: boolean): string[] {
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

  if (includePeople) {
    for (const key of PERSON_KEYS) {
      for (const person of getPeople(meta, key)) push(person.name);
    }
  }
  return out;
}

/**
 * The tag chips shown on an item: its own tags plus a couple of stable metadata
 * values. Credited people are deliberately NOT here — their names already read
 * under the title, and repeating them as chips is pure duplication.
 */
export function getVisibleTags(item: TaggableItem): string[] {
  return collectTags(item, false);
}

/**
 * Everything an item can be matched on: the visible tags plus every credited
 * person (director / creator / author / developer). People are hidden tags —
 * invisible in the UI, but fully searchable and filterable, and they follow the
 * field, so renaming a director makes the item findable under the new name.
 */
export function getSearchTags(item: TaggableItem): string[] {
  return collectTags(item, true);
}

/**
 * Returns Tailwind colour classes for a given item status value.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    plan_to_consume: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    consuming: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    completed: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    // Opt-out: deliberately colourless, so it reads as "switched off".
    not_interested: 'bg-stone-800/40 text-stone-400 border-stone-700/60',
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
