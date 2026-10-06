// ============================================
// Group archive export / import — pure logic
// ============================================
//
// The on-disk format ("friend-archive-group") is documented in the
// rulebook dialog of GroupArchiveData. Bump ARCHIVE_VERSION when the
// structure changes in a non-backwards-compatible way.

import type { MediaType, ItemStatus, ExternalWork } from '@/types';

export const ARCHIVE_FORMAT = 'friend-archive-group';
export const ARCHIVE_VERSION = 1;

export const MEDIA_TYPES: readonly MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];
export const ITEM_STATUSES: readonly ItemStatus[] = [
  'plan_to_consume',
  'consuming',
  'completed',
  'not_interested',
];

type MetadataFieldKind = 'string' | 'number' | 'string[]';

/** Allowed metadata keys per media type, mirroring types/index.ts */
export const METADATA_FIELDS: Record<MediaType, Record<string, MetadataFieldKind>> = {
  movie: { director: 'string', release_year: 'number', duration_minutes: 'number' },
  tv_series: { creator: 'string', release_year: 'number', seasons: 'number', platform: 'string' },
  book: { author: 'string', publication_year: 'number', publisher: 'string' },
  video_game: { developer: 'string', publisher: 'string', release_year: 'number', platforms: 'string[]' },
};

export interface ArchiveItem {
  title: string;
  type: MediaType;
  /** Personal status: the exporter's own on export; sets the importer's own on import. */
  status: ItemStatus;
  genre: string | null;
  metadata: Record<string, unknown>;
  /** Namespaced provider id (e.g. "tmdb:movie:693134"). On import it is resolved against the provider. */
  external_id: string | null;
  external_url: string | null;
}

export interface GroupArchive {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  exported_at: string;
  group: {
    name: string;
    description: string | null;
    visibility: 'public' | 'private';
  };
  /** Exports carry only the id; external_url is accepted on import as an alternative. */
  items: Array<Omit<ArchiveItem, 'external_url'>>;
}

/**
 * Most items one import may carry. Every item can cost two paced provider
 * calls, so this caps one import at a few minutes of background work.
 */
export const MAX_IMPORT_ITEMS = 200;
/** Largest file accepted, checked before it is even read. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export interface RejectedItem {
  /** 1-based position in the file's items array */
  position: number;
  title: string | null;
  reason: string;
}

export interface ParsedArchive {
  items: ArchiveItem[];
  /** Entries in the file that did not pass validation, with why */
  rejected: RejectedItem[];
}

/** Identity of an item inside a group: same title (case-insensitive) + same type */
export function itemKey(title: string, type: MediaType): string {
  return `${title.trim().toLowerCase()}::${type}`;
}

export function buildArchive(
  group: { name: string; description: string | null; visibility: 'public' | 'private' },
  items: Array<{
    title: string;
    type: MediaType;
    status: ItemStatus;
    genre: string | null;
    metadata: Record<string, unknown> | null;
    external_id: string | null;
  }>
): GroupArchive {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exported_at: new Date().toISOString(),
    group: {
      name: group.name,
      description: group.description,
      visibility: group.visibility,
    },
    items: items.map((item) => ({
      title: item.title,
      type: item.type,
      status: item.status,
      genre: item.genre,
      metadata: sanitizeMetadata(item.type, item.metadata ?? {}),
      external_id: item.external_id,
    })),
  };
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Keeps only the allowed keys for the type, with valid value shapes. */
export function sanitizeMetadata(
  type: MediaType,
  raw: unknown
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const allowed = METADATA_FIELDS[type];
  const out: Record<string, unknown> = {};

  for (const [key, kind] of Object.entries(allowed)) {
    const value = (raw as Record<string, unknown>)[key];
    if (isEmptyValue(value)) continue;

    if (kind === 'string' && typeof value === 'string') {
      out[key] = value.trim();
    } else if (kind === 'number') {
      const num = typeof value === 'string' ? Number(value) : value;
      if (typeof num === 'number' && Number.isFinite(num)) out[key] = num;
    } else if (kind === 'string[]' && Array.isArray(value)) {
      const list = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      if (list.length > 0) out[key] = list.map((v) => v.trim());
    }
  }
  return out;
}

/**
 * Parses and validates the raw text of an import file.
 * Throws an Error with a user-readable message when the file as a whole
 * is unusable; individually broken items are listed in `rejected` and never
 * imported — a suspicious field rejects the whole item rather than being
 * silently dropped.
 */
export function parseArchive(text: string): ParsedArchive {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('The file must contain a JSON object. Check the rulebook for the structure.');
  }

  const root = data as Record<string, unknown>;
  if (root.format !== undefined && root.format !== ARCHIVE_FORMAT) {
    throw new Error(`Unknown format "${String(root.format)}". Expected "${ARCHIVE_FORMAT}".`);
  }
  if (!Array.isArray(root.items)) {
    throw new Error('Missing "items" array. Check the rulebook for the structure.');
  }
  if (root.items.length > MAX_IMPORT_ITEMS) {
    throw new Error(
      `This file has ${root.items.length} items; one import takes at most ${MAX_IMPORT_ITEMS}. Split it into smaller files.`
    );
  }

  const items: ArchiveItem[] = [];
  const seen = new Set<string>();
  const rejected: RejectedItem[] = [];

  for (const [index, entry] of root.items.entries()) {
    const result = parseItem(entry);
    if ('reason' in result) {
      const title = (entry as { title?: unknown } | null)?.title;
      rejected.push({
        position: index + 1,
        title: typeof title === 'string' ? title.trim().slice(0, 80) : null,
        reason: result.reason,
      });
      continue;
    }
    const item = result.item;
    // Duplicates inside the same file: first occurrence wins
    const key = itemKey(item.title, item.type);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return { items, rejected };
}

// Control characters have no business in a title or a tag; their presence
// marks a file as tampered with or broken.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const MAX_TITLE_LENGTH = 300;
const MAX_GENRE_LENGTH = 255;

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

function parseItem(entry: unknown): { item: ArchiveItem } | { reason: string } {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { reason: 'not an object' };
  }
  const raw = entry as Record<string, unknown>;

  if (typeof raw.title !== 'string' || raw.title.trim() === '') return { reason: 'missing title' };
  const title = raw.title.trim();
  if (title.length > MAX_TITLE_LENGTH) return { reason: `title longer than ${MAX_TITLE_LENGTH} characters` };
  if (CONTROL_CHARS.test(title)) return { reason: 'title contains control characters' };

  if (typeof raw.type !== 'string' || !MEDIA_TYPES.includes(raw.type as MediaType)) {
    return { reason: `unknown type "${String(raw.type).slice(0, 40)}"` };
  }
  const type = raw.type as MediaType;

  const status = parseStatus(raw.status);
  if (!status) return { reason: `unknown status "${String(raw.status).slice(0, 40)}"` };

  let genre: string | null = null;
  if (!isBlank(raw.genre)) {
    if (typeof raw.genre !== 'string') return { reason: 'genre is not text' };
    genre = raw.genre.trim();
    if (genre.length > MAX_GENRE_LENGTH) return { reason: `genre longer than ${MAX_GENRE_LENGTH} characters` };
    if (CONTROL_CHARS.test(genre)) return { reason: 'genre contains control characters' };
  }

  if (raw.metadata !== undefined && raw.metadata !== null &&
      (typeof raw.metadata !== 'object' || Array.isArray(raw.metadata))) {
    return { reason: 'metadata is not an object' };
  }

  const link = parseExternalLink(type, raw.external_id, raw.external_url);
  if ('reason' in link) return link;

  return {
    item: {
      title,
      type,
      status,
      genre,
      metadata: sanitizeMetadata(type, raw.metadata),
      ...link,
    },
  };
}

/** Exact shape of a valid external_id per type — nothing else is accepted. */
const EXTERNAL_ID_SHAPE: Record<MediaType, RegExp> = {
  movie: /^tmdb:movie:(\d{1,10})$/,
  tv_series: /^tmdb:tv:(\d{1,10})$/,
  book: /^openlibrary:book:(OL\d{1,10}W)$/,
  video_game: /^rawg:game:(\d{1,10})$/,
};

/**
 * Exact shape of a valid page URL per type (no query strings, no other
 * hosts). The capture is the id — or, for RAWG, the slug.
 */
const EXTERNAL_URL_SHAPE: Record<MediaType, RegExp> = {
  // TMDB pages may carry a title suffix ("/movie/693134-dune-part-two").
  movie: /^https:\/\/(?:www\.)?themoviedb\.org\/movie\/(\d{1,10})(?:-[a-z0-9-]{1,200})?\/?$/,
  tv_series: /^https:\/\/(?:www\.)?themoviedb\.org\/tv\/(\d{1,10})(?:-[a-z0-9-]{1,200})?\/?$/,
  // Open Library pages may carry a title segment ("/works/OL123W/Dune").
  book: /^https:\/\/openlibrary\.org\/works\/(OL\d{1,10}W)(?:\/[A-Za-z0-9_.,'()-]{1,200})?\/?$/,
  video_game: /^https:\/\/rawg\.io\/games\/([a-z0-9-]{1,100})\/?$/,
};

/** Canonical page URL rebuilt from an id, for the types whose URL holds the id. */
const EXTERNAL_URL_BASE: Record<Exclude<MediaType, 'video_game'>, string> = {
  movie: 'https://www.themoviedb.org/movie/',
  tv_series: 'https://www.themoviedb.org/tv/',
  book: 'https://openlibrary.org/works/',
};

/**
 * Reads the item's link to its provider. Both fields are optional, but a
 * field that IS given must have the exact expected shape — otherwise the
 * whole item is rejected. Movies, TV and books carry their id in the URL, so
 * either one is enough (and when both are given they must agree). Games
 * can't be rebuilt locally (numeric id vs slug URL): a URL alone becomes a
 * slug id ("rawg:game:gta-v"), and the import's detail call returns the
 * numeric id and the URL.
 */
function parseExternalLink(
  type: MediaType,
  rawId: unknown,
  rawUrl: unknown
): { external_id: string | null; external_url: string | null } | { reason: string } {
  let id: string | null = null;
  if (!isBlank(rawId)) {
    if (typeof rawId !== 'string') return { reason: 'external_id is not text' };
    id = rawId.trim().match(EXTERNAL_ID_SHAPE[type])?.[1] ?? null;
    if (!id) return { reason: `malformed external_id "${rawId.slice(0, 60)}"` };
  }

  let urlKey: string | null = null;
  let url: string | null = null;
  if (!isBlank(rawUrl)) {
    if (typeof rawUrl !== 'string') return { reason: 'external_url is not text' };
    url = rawUrl.trim().replace(/\/$/, '');
    urlKey = rawUrl.trim().match(EXTERNAL_URL_SHAPE[type])?.[1] ?? null;
    if (!urlKey) return { reason: `malformed external_url "${rawUrl.slice(0, 80)}"` };
  }

  const prefix = EXTERNAL_ID_PREFIX[type];
  if (type === 'video_game') {
    if (id) return { external_id: prefix + id, external_url: url };
    return { external_id: urlKey ? prefix + urlKey : null, external_url: url };
  }

  if (id && urlKey && id !== urlKey) return { reason: 'external_id and external_url point to different works' };
  const key = id ?? urlKey;
  return key
    ? { external_id: prefix + key, external_url: EXTERNAL_URL_BASE[type] + key }
    : { external_id: null, external_url: null };
}

/**
 * Status as written by a person: the stored codes or the labels the app shows
 * ("Planned", "In progress", …), any case, spaces/hyphens/underscores alike.
 * Missing → 'plan_to_consume'; anything else unrecognised → null (rejected).
 */
const STATUS_ALIASES: Record<string, ItemStatus> = {
  planned: 'plan_to_consume',
  in_progress: 'consuming',
};

function parseStatus(raw: unknown): ItemStatus | null {
  if (isBlank(raw)) return 'plan_to_consume';
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ITEM_STATUSES.includes(key as ItemStatus)) return key as ItemStatus;
  return STATUS_ALIASES[key] ?? null;
}

/** The namespace an external_id must carry for each type, so a file can't link a book to a game. */
export const EXTERNAL_ID_PREFIX: Record<MediaType, string> = {
  movie: 'tmdb:movie:',
  tv_series: 'tmdb:tv:',
  book: 'openlibrary:book:',
  video_game: 'rawg:game:',
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const YEAR_KEY: Record<MediaType, string> = {
  movie: 'release_year',
  tv_series: 'release_year',
  book: 'publication_year',
  video_game: 'release_year',
};

const PEOPLE_KEY: Record<MediaType, string> = {
  movie: 'director',
  tv_series: 'creator',
  book: 'author',
  video_game: 'developer',
};

/**
 * Picks the search result that best matches an imported item that has no
 * external_id, or null when nothing is convincing enough to link.
 *
 * Scoring: exact (normalized) title 3, one title containing the other 1,
 * same year 2 (off by one 1), a shared director/author/developer name 2.
 * A link needs 3 points: an exact title alone, or a looser title backed by
 * the year or the people.
 */
export function pickBestMatch(item: ArchiveItem, results: ExternalWork[]): ExternalWork | null {
  const title = normalizeTitle(item.title);
  const year = item.metadata[YEAR_KEY[item.type]];
  const people = item.metadata[PEOPLE_KEY[item.type]];
  const names =
    typeof people === 'string'
      ? people.split(',').map(normalizeTitle).filter(Boolean)
      : [];

  let best: ExternalWork | null = null;
  let bestScore = 0;
  for (const work of results) {
    if (work.type !== item.type) continue;
    const candidate = normalizeTitle(work.title);
    let score = 0;
    if (candidate === title) score += 3;
    else if (candidate.includes(title) || title.includes(candidate)) score += 1;
    else continue;

    if (typeof year === 'number' && work.year) {
      if (work.year === year) score += 2;
      else if (Math.abs(work.year - year) === 1) score += 1;
    }
    const subtitle = normalizeTitle(work.subtitle ?? '');
    if (subtitle && names.some((name) => subtitle.includes(name))) score += 2;

    // Ties keep the provider's own ranking (first result wins).
    if (score > bestScore) {
      best = work;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

export interface MergePatch {
  genre?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Compares an existing item with an imported one and returns the fields to
 * update, or null when the import brings nothing new.
 *
 * Rule: imports only FILL GAPS. A value already present in the archive is
 * never overwritten; status and title are never touched on update.
 */
export function mergeNewInfo(
  existing: { genre: string | null; metadata: Record<string, unknown> | null },
  incoming: ArchiveItem
): MergePatch | null {
  const patch: MergePatch = {};

  if (isEmptyValue(existing.genre) && incoming.genre) {
    patch.genre = incoming.genre;
  }

  const existingMeta = existing.metadata ?? {};
  const mergedMeta = { ...existingMeta };
  let metaChanged = false;
  for (const [key, value] of Object.entries(incoming.metadata)) {
    if (isEmptyValue(existingMeta[key])) {
      mergedMeta[key] = value;
      metaChanged = true;
    }
  }
  if (metaChanged) patch.metadata = mergedMeta;

  return patch.genre === undefined && patch.metadata === undefined ? null : patch;
}
