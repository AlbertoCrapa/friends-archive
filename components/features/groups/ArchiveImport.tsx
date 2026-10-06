'use client';

// ============================================================================
// Archive import runner.
//
// Lives at the root, next to the toast dock, so an import keeps going while
// the member navigates away from the settings page. Each item is resolved
// against its provider — by external_id when the file has one, otherwise by a
// title search scored with pickBestMatch — and saved as soon as it is ready,
// so closing the tab mid-way keeps everything already done.
//
// Provider calls go out ONE AT A TIME with a gap per provider (GAP_MS): a
// 200-item file must never look like a burst to TMDB / RAWG / Open Library.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { safeImageUrl } from '@/lib/utils';
import {
  EXTERNAL_ID_PREFIX,
  itemKey,
  mergeNewInfo,
  pickBestMatch,
  type ArchiveItem,
} from '@/lib/groupArchive';
import type { ExternalSource, ExternalWork, MediaType } from '@/types';

/** Minimum time between two calls to the same provider. Open Library is the strictest. */
const GAP_MS: Record<ExternalSource, number> = { tmdb: 500, rawg: 500, openlibrary: 1200 };

interface Job {
  groupId: string;
  groupName: string;
  userId: string;
  items: ArchiveItem[];
  invalid: number;
}

interface Progress {
  groupName: string;
  done: number;
  total: number;
}

interface Resolved {
  external_id: string;
  external_source: ExternalSource;
  external_url: string | null;
  genre: string | null;
  metadata: Record<string, unknown>;
  image_url: string | null;
}

interface DetailsResponse {
  metadata: Record<string, unknown> | null;
  genre: string | null;
  image_url: string | null;
  external_id: string | null;
  external_url: string | null;
}

interface ArchiveImportApi {
  running: boolean;
  /** Starts an import in the background. False when one is already running. */
  start: (job: Job) => boolean;
}

const ArchiveImportContext = createContext<ArchiveImportApi | null>(null);

export function useArchiveImport(): ArchiveImportApi {
  const api = useContext(ArchiveImportContext);
  if (!api) throw new Error('useArchiveImport must be used inside <ArchiveImportProvider>');
  return api;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sourceOf(type: MediaType): ExternalSource {
  return EXTERNAL_ID_PREFIX[type].split(':')[0] as ExternalSource;
}

export function ArchiveImportProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const runningRef = useRef(false);
  const lastCallAt = useRef<Partial<Record<ExternalSource, number>>>({});

  /** GET one of our provider routes, waiting out the provider's gap first. Null on any failure. */
  const paced = useCallback(async <T,>(source: ExternalSource, url: string): Promise<T | null> => {
    const wait = (lastCallAt.current[source] ?? 0) + GAP_MS[source] - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt.current[source] = Date.now();
    try {
      const res = await fetch(url);
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }, []);

  /**
   * The provider's view of an item, merged the way a manual add would: provider
   * data wins, the file only fills what the provider doesn't know. Null when a
   * title search finds nothing convincing (the item is then imported as manual).
   */
  const resolve = useCallback(
    async (item: ArchiveItem): Promise<Resolved | null> => {
      const source = sourceOf(item.type);
      let work: ExternalWork | null = null;

      if (!item.external_id) {
        const search = await paced<{ results: ExternalWork[] }>(
          source,
          `/api/external-search?type=${item.type}&q=${encodeURIComponent(item.title)}`
        );
        work = pickBestMatch(item, search?.results ?? []);
        if (!work) return null;
      }

      const requestedId = work?.external_id ?? item.external_id!;
      const details = await paced<DetailsResponse>(
        source,
        `/api/external-details?id=${encodeURIComponent(requestedId)}`
      );

      // An id that came with the file stays linked even if the provider is down
      // right now: the item keeps the file's data and can be refreshed later.
      // Games: details swap a slug-based id for the numeric one and supply the URL.
      // ponytail: if RAWG is down, a URL-only game keeps its slug id (RAWG accepts it too).
      return {
        external_id: details?.external_id ?? requestedId,
        external_source: source,
        external_url: details?.external_url ?? work?.external_url ?? item.external_url,
        genre: details?.genre || work?.genre || item.genre,
        metadata: {
          ...item.metadata,
          ...((work?.metadata as Record<string, unknown>) ?? {}),
          ...(details?.metadata ?? {}),
        },
        image_url: safeImageUrl(details?.image_url) ?? safeImageUrl(work?.image_url),
      };
    },
    [paced]
  );

  const run = useCallback(
    async ({ groupId, groupName, userId, items, invalid }: Job) => {
      const supabase = createClient();
      const counts = { added: 0, updated: 0, unchanged: 0, linked: 0, notFound: 0, failed: 0 };

      try {
        const { data: existing, error: fetchError } = await supabase
          .from('media_items')
          .select('id, title, type, genre, metadata, external_id, image_url')
          .eq('group_id', groupId);
        if (fetchError) {
          toast({ message: 'Import failed: could not load the current catalogue.', tone: 'destructive' });
          return;
        }

        type Row = NonNullable<typeof existing>[number];
        const byKey = new Map<string, Row>();
        const byExternalId = new Map<string, Row>();
        const remember = (row: Row) => {
          byKey.set(itemKey(row.title, row.type as MediaType), row);
          if (row.external_id) byExternalId.set(row.external_id, row);
        };
        (existing ?? []).forEach(remember);

        for (const [index, item] of items.entries()) {
          setProgress({ groupName, done: index, total: items.length });

          let match =
            (item.external_id && byExternalId.get(item.external_id)) ||
            byKey.get(itemKey(item.title, item.type));

          // Already linked: nothing to ask the provider, just fill gaps from the file.
          if (match?.external_id) {
            const patch = mergeNewInfo(match, item);
            if (!patch) {
              counts.unchanged += 1;
              continue;
            }
            const { error } = await supabase.from('media_items').update(patch).eq('id', match.id);
            if (error) counts.failed += 1;
            else counts.updated += 1;
            continue;
          }

          const resolved = await resolve(item);
          if (resolved) counts.linked += 1;
          else counts.notFound += 1;

          // A search can land on a work the group already has under another title.
          if (!match && resolved) match = byExternalId.get(resolved.external_id);

          if (match) {
            // Existing item: link it if it wasn't, and fill only its gaps.
            const patch: Record<string, unknown> = {
              ...(mergeNewInfo(match, resolved ? { ...item, ...resolved } : item) ?? {}),
            };
            if (resolved && !match.external_id) {
              patch.external_id = resolved.external_id;
              patch.external_source = resolved.external_source;
              patch.external_url = resolved.external_url;
            }
            if (resolved?.image_url && !match.image_url) patch.image_url = resolved.image_url;
            if (Object.keys(patch).length === 0) {
              counts.unchanged += 1;
              continue;
            }
            const { error } = await supabase.from('media_items').update(patch).eq('id', match.id);
            if (error) counts.failed += 1;
            else counts.updated += 1;
            continue;
          }

          const { data: inserted, error: insertError } = await supabase
            .from('media_items')
            .insert({
              group_id: groupId,
              added_by: userId,
              title: item.title,
              type: item.type,
              genre: resolved?.genre ?? item.genre,
              metadata: resolved?.metadata ?? item.metadata,
              external_id: resolved?.external_id ?? null,
              external_source: resolved?.external_source ?? null,
              external_url: resolved?.external_url ?? null,
              image_url: resolved?.image_url ?? null,
            })
            .select('id, title, type, genre, metadata, external_id, image_url')
            .single();
          if (insertError || !inserted) {
            counts.failed += 1;
            continue;
          }
          remember(inserted);
          counts.added += 1;

          // The file's status becomes the IMPORTER'S own (per-member model).
          // No row needed for 'plan_to_consume' — that's the default meaning.
          if (item.status !== 'plan_to_consume') {
            await supabase
              .from('item_statuses')
              .upsert(
                { media_item_id: inserted.id, user_id: userId, status: item.status },
                { onConflict: 'media_item_id,user_id' }
              );
            // Keep the completed ⇄ consumed invariant for the importer.
            if (item.status === 'completed') {
              await supabase
                .from('consumption_records')
                .upsert(
                  { media_item_id: inserted.id, user_id: userId },
                  { onConflict: 'media_item_id,user_id' }
                );
            }
          }
        }

        const parts = [
          `${counts.added} added`,
          `${counts.updated} updated`,
          `${counts.unchanged} already up to date`,
        ];
        if (counts.linked > 0) parts.push(`${counts.linked} matched online`);
        if (counts.notFound > 0) parts.push(`${counts.notFound} not found online (kept as manual)`);
        if (invalid > 0) parts.push(`${invalid} invalid skipped`);
        if (counts.failed > 0) parts.push(`${counts.failed} failed`);

        toast({
          message: `Import into ${groupName} complete: ${parts.join(', ')}.`,
          tone: counts.failed > 0 ? 'destructive' : 'success',
          durationMs: 8000,
        });
        router.refresh();
      } finally {
        setProgress(null);
        runningRef.current = false;
      }
    },
    [resolve, router, toast]
  );

  const start = useCallback(
    (job: Job) => {
      if (runningRef.current) return false;
      runningRef.current = true;
      setProgress({ groupName: job.groupName, done: 0, total: job.items.length });
      void run(job);
      return true;
    },
    [run]
  );

  // Closing the tab stops the import (saved items stay saved) — ask first.
  useEffect(() => {
    if (!progress) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [progress]);

  return (
    <ArchiveImportContext.Provider value={{ running: progress !== null, start }}>
      {children}
      {progress && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-4 bottom-4 sm:left-8 sm:bottom-8 z-[999998] flex items-center gap-2.5 px-3.5 py-2 bg-[#27272a] text-stone-100 text-xs shadow-lg"
        >
          <Spinner className="h-3.5 w-3.5" />
          <span>
            Importing into {progress.groupName} · {progress.done}/{progress.total}
          </span>
        </div>
      )}
    </ArchiveImportContext.Provider>
  );
}
