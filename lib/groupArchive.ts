// ============================================
// Group archive export / import — pure logic
// ============================================
//
// The on-disk format ("friend-archive-group") is documented in the
// rulebook dialog of GroupArchiveData. Bump ARCHIVE_VERSION when the
// structure changes in a non-backwards-compatible way.

import type { MediaType, ItemStatus } from '@/types';

export const ARCHIVE_FORMAT = 'friend-archive-group';
export const ARCHIVE_VERSION = 1;

export const MEDIA_TYPES: readonly MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];
export const ITEM_STATUSES: readonly ItemStatus[] = ['plan_to_consume', 'consuming', 'completed'];

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
  status: ItemStatus;
  genre: string | null;
  metadata: Record<string, unknown>;
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
  items: ArchiveItem[];
}

export interface ParsedArchive {
  items: ArchiveItem[];
  /** Entries in the file that did not pass validation */
  invalid: number;
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
 * is unusable; individually broken items are counted in `invalid`.
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

  const items: ArchiveItem[] = [];
  const seen = new Set<string>();
  let invalid = 0;

  for (const entry of root.items) {
    const item = parseItem(entry);
    if (!item) {
      invalid += 1;
      continue;
    }
    // Duplicates inside the same file: first occurrence wins
    const key = itemKey(item.title, item.type);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return { items, invalid };
}

function parseItem(entry: unknown): ArchiveItem | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
  const raw = entry as Record<string, unknown>;

  if (typeof raw.title !== 'string' || raw.title.trim() === '') return null;
  if (typeof raw.type !== 'string' || !MEDIA_TYPES.includes(raw.type as MediaType)) return null;

  const type = raw.type as MediaType;
  const status = ITEM_STATUSES.includes(raw.status as ItemStatus)
    ? (raw.status as ItemStatus)
    : 'plan_to_consume';
  const genre =
    typeof raw.genre === 'string' && raw.genre.trim() !== '' ? raw.genre.trim() : null;

  return {
    title: raw.title.trim(),
    type,
    status,
    genre,
    metadata: sanitizeMetadata(type, raw.metadata),
  };
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
