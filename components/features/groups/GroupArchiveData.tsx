'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { FormBanner } from '@/components/ui/form-banner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Download, Upload, BookMarked } from 'lucide-react';
import {
  buildArchive,
  parseArchive,
  mergeNewInfo,
  itemKey,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  type MergePatch,
} from '@/lib/groupArchive';
import type { MediaType, ItemStatus } from '@/types';

interface Props {
  group: {
    id: string;
    name: string;
    description: string | null;
    visibility: 'public' | 'private';
  };
  userId: string;
}

interface Banner {
  variant: 'error' | 'success' | 'info';
  message: string;
}

const EXAMPLE_JSON = `{
  "format": "${ARCHIVE_FORMAT}",
  "version": ${ARCHIVE_VERSION},
  "group": {
    "name": "Cinema Crew",
    "description": "Friday night watchlist",
    "visibility": "private"
  },
  "items": [
    {
      "title": "Dune: Part Two",
      "type": "movie",
      "status": "completed",
      "genre": "Sci-Fi",
      "metadata": {
        "director": "Denis Villeneuve",
        "release_year": 2024,
        "duration_minutes": 166
      }
    },
    {
      "title": "Project Hail Mary",
      "type": "book",
      "status": "consuming",
      "genre": null,
      "metadata": { "author": "Andy Weir", "publication_year": 2021 }
    }
  ]
}`;

const METADATA_RULES: Array<{ type: string; keys: string }> = [
  { type: 'movie', keys: 'director (text), release_year (number), duration_minutes (number)' },
  { type: 'tv_series', keys: 'creator (text), release_year (number), seasons (number), platform (text)' },
  { type: 'book', keys: 'author (text), publication_year (number), publisher (text)' },
  { type: 'video_game', keys: 'developer (text), publisher (text), release_year (number), platforms (list of text)' },
];

export function GroupArchiveData({ group, userId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  async function handleExport() {
    setBanner(null);
    setExporting(true);

    const supabase = createClient();
    // Status is per-member, so the export carries the EXPORTER'S OWN statuses
    // (missing item_statuses row = 'plan_to_consume').
    const [{ data: items, error }, { data: statusRows, error: statusError }] = await Promise.all([
      supabase
        .from('media_items')
        .select('id, title, type, genre, metadata')
        .eq('group_id', group.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('item_statuses')
        .select('media_item_id, status, media_items!inner(group_id)')
        .eq('user_id', userId)
        .eq('media_items.group_id', group.id),
    ]);

    if (error || statusError) {
      setBanner({ variant: 'error', message: 'Could not load the group data. Please try again.' });
      setExporting(false);
      return;
    }

    const statusByItemId = new Map(
      (statusRows ?? []).map((row) => [row.media_item_id, row.status as ItemStatus])
    );

    const archive = buildArchive(
      group,
      (items ?? []).map((item) => ({
        title: item.title,
        type: item.type as MediaType,
        status: statusByItemId.get(item.id) ?? 'plan_to_consume',
        genre: item.genre,
        metadata: item.metadata,
      }))
    );
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
    a.href = url;
    a.download = `friend-archive-${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setBanner({
      variant: 'success',
      message: `Exported ${archive.items.length} item${archive.items.length === 1 ? '' : 's'}.`,
    });
    setExporting(false);
  }

  async function handleImportFile(file: File) {
    setBanner(null);
    setImporting(true);

    try {
      const { items, invalid } = parseArchive(await file.text());
      if (items.length === 0) {
        setBanner({
          variant: 'error',
          message:
            invalid > 0
              ? 'No valid items found in this file. Check the rulebook for the structure.'
              : 'This file contains no items.',
        });
        return;
      }

      const supabase = createClient();
      const { data: existing, error: fetchError } = await supabase
        .from('media_items')
        .select('id, title, type, genre, metadata')
        .eq('group_id', group.id);

      if (fetchError) {
        setBanner({ variant: 'error', message: 'Could not load the current catalogue. Please try again.' });
        return;
      }

      const existingByKey = new Map(
        (existing ?? []).map((item) => [itemKey(item.title, item.type as MediaType), item])
      );

      const toInsert: Array<{
        group_id: string;
        added_by: string;
        title: string;
        type: MediaType;
        genre: string | null;
        metadata: Record<string, unknown>;
      }> = [];
      // The archive's status becomes the IMPORTER'S personal status for each
      // newly created item (per-member model). Aligned by index with toInsert.
      const insertStatuses: ItemStatus[] = [];
      const toUpdate: Array<{ id: string; patch: MergePatch }> = [];
      let unchanged = 0;

      for (const item of items) {
        const match = existingByKey.get(itemKey(item.title, item.type));
        if (!match) {
          toInsert.push({
            group_id: group.id,
            added_by: userId,
            title: item.title,
            type: item.type,
            genre: item.genre,
            metadata: item.metadata,
          });
          insertStatuses.push(item.status);
          continue;
        }
        const patch = mergeNewInfo(match, item);
        if (patch) {
          toUpdate.push({ id: match.id, patch });
        } else {
          unchanged += 1;
        }
      }

      if (toInsert.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('media_items')
          .insert(toInsert)
          .select('id');
        if (insertError) {
          setBanner({ variant: 'error', message: 'Could not add the new items. Please try again.' });
          return;
        }

        // Personal statuses for the new items (rows come back in insert order).
        // No row needed for 'plan_to_consume' — that's the default meaning.
        const statusUpserts = (insertedRows ?? []).flatMap((row, i) =>
          insertStatuses[i] && insertStatuses[i] !== 'plan_to_consume'
            ? [{ media_item_id: row.id, user_id: userId, status: insertStatuses[i] }]
            : []
        );
        if (statusUpserts.length > 0) {
          await supabase
            .from('item_statuses')
            .upsert(statusUpserts, { onConflict: 'media_item_id,user_id' });
          // Keep the completed ⇄ consumed invariant for the importer.
          const consumedUpserts = statusUpserts
            .filter((row) => row.status === 'completed')
            .map((row) => ({ media_item_id: row.media_item_id, user_id: userId }));
          if (consumedUpserts.length > 0) {
            await supabase
              .from('consumption_records')
              .upsert(consumedUpserts, { onConflict: 'media_item_id,user_id' });
          }
        }
      }

      let updateFailures = 0;
      for (const { id, patch } of toUpdate) {
        const { error: updateError } = await supabase
          .from('media_items')
          .update(patch)
          .eq('id', id);
        if (updateError) updateFailures += 1;
      }

      const parts = [
        `${toInsert.length} added`,
        `${toUpdate.length - updateFailures} updated`,
        `${unchanged} already up to date`,
      ];
      if (invalid > 0) parts.push(`${invalid} invalid skipped`);
      if (updateFailures > 0) parts.push(`${updateFailures} failed`);

      setBanner({
        variant: updateFailures > 0 ? 'error' : 'success',
        message: `Import complete: ${parts.join(', ')}.`,
      });
      router.refresh();
    } catch (err) {
      setBanner({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Could not read this file.',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm font-light leading-relaxed">
        Download the full catalogue of this group as a JSON file, or import one.
        Imported items matching an existing title and type are not duplicated:
        they only fill in missing details.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExport}
          disabled={exporting || importing}
        >
          {exporting ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          Export JSON
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={exporting || importing}
        >
          {importing ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
          Import JSON
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <BookMarked className="h-3.5 w-3.5" />
              Format rulebook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Archive file rulebook</DialogTitle>
              <DialogDescription>
                The structure every import file must follow. Exports already comply.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 overflow-y-auto max-h-[65vh] pr-1">
              <section className="space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Rules</h3>
                <ul className="space-y-2 text-sm text-stone-400 font-light leading-relaxed list-disc pl-5">
                  <li>
                    The file is a single JSON object with an <code className="text-stone-200">items</code> array.
                    Everything else (<code className="text-stone-200">format</code>,{' '}
                    <code className="text-stone-200">version</code>, <code className="text-stone-200">group</code>) is
                    optional on import.
                  </li>
                  <li>
                    Each item needs a non-empty <code className="text-stone-200">title</code> and a{' '}
                    <code className="text-stone-200">type</code>: one of{' '}
                    <code className="text-stone-200">movie</code>, <code className="text-stone-200">tv_series</code>,{' '}
                    <code className="text-stone-200">book</code>, <code className="text-stone-200">video_game</code>.
                  </li>
                  <li>
                    <code className="text-stone-200">status</code> is optional and personal:{' '}
                    <code className="text-stone-200">plan_to_consume</code> (Planned),{' '}
                    <code className="text-stone-200">consuming</code> (In progress) or{' '}
                    <code className="text-stone-200">completed</code> (Completed). It sets{' '}
                    <em className="not-italic text-stone-200">your own</em> status for the imported
                    item — never other members&apos;. Missing or invalid values fall back to{' '}
                    <code className="text-stone-200">plan_to_consume</code>.
                  </li>
                  <li>
                    <code className="text-stone-200">genre</code> is optional text,{' '}
                    <code className="text-stone-200">metadata</code> is an optional object. Unknown metadata keys are
                    ignored.
                  </li>
                  <li>Items that break these rules are skipped; the rest of the file still imports.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
                  Metadata keys per type
                </h3>
                <div className="border border-stone-800/50">
                  {METADATA_RULES.map((rule) => (
                    <div
                      key={rule.type}
                      className="px-4 py-2.5 border-b border-stone-800/30 last:border-b-0 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                    >
                      <code className="font-mono text-xs shrink-0 sm:w-28" style={{ color: 'var(--color-accent)' }}>
                        {rule.type}
                      </code>
                      <span className="text-xs text-stone-400 font-light">{rule.keys}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">How merging works</h3>
                <p className="text-sm text-stone-400 font-light leading-relaxed">
                  An imported item with the same title (case-insensitive) and the same type as an existing one is never
                  duplicated. Instead, it fills in details the existing item is missing: an empty genre or absent
                  metadata keys. Values already present, everyone&apos;s statuses, and the title itself are never
                  overwritten.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Example</h3>
                <pre className="border border-stone-800/50 bg-[var(--color-surface)] p-4 overflow-x-auto text-[11px] leading-relaxed font-mono text-stone-300">
                  {EXAMPLE_JSON}
                </pre>
              </section>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleImportFile(file);
        }}
      />

      {banner && <FormBanner message={banner.message} variant={banner.variant} />}
    </div>
  );
}
