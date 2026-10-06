'use client';

import { useRef, useState } from 'react';
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
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ITEMS,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
} from '@/lib/groupArchive';
import { useArchiveImport } from '@/components/features/groups/ArchiveImport';
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
      },
      "external_id": "tmdb:movie:693134"
    },
    {
      "title": "Project Hail Mary",
      "type": "book",
      "status": "In progress",
      "external_url": "https://openlibrary.org/works/OL21745884W"
    },
    {
      "title": "Hades",
      "type": "video_game",
      "metadata": { "developer": "Supergiant Games", "release_year": 2020 }
    }
  ]
}`;

// How each source's link is written. Either column alone is enough on import.
const LINK_RULES: Array<{ type: string; id: string; url: string }> = [
  { type: 'movie', id: 'tmdb:movie:693134', url: 'https://www.themoviedb.org/movie/693134' },
  { type: 'tv_series', id: 'tmdb:tv:1399', url: 'https://www.themoviedb.org/tv/1399' },
  { type: 'book', id: 'openlibrary:book:OL21745884W', url: 'https://openlibrary.org/works/OL21745884W' },
  { type: 'video_game', id: 'rawg:game:3498', url: 'https://rawg.io/games/grand-theft-auto-v' },
];

// People fields take several names in one comma-separated string.
const METADATA_RULES: Array<{ type: string; keys: string }> = [
  { type: 'movie', keys: 'director (text, comma-separated for several), release_year (number), duration_minutes (number)' },
  { type: 'tv_series', keys: 'creator (text, comma-separated for several), release_year (number), seasons (number), platform (text)' },
  { type: 'book', keys: 'author (text, comma-separated for several), publication_year (number), publisher (text)' },
  { type: 'video_game', keys: 'developer (text, comma-separated for several), publisher (text), release_year (number), platforms (list of text)' },
];

export function GroupArchiveData({ group, userId }: Props) {
  const archiveImport = useArchiveImport();
  // `reading` covers the moment between picking the file and the import
  // starting, so a second click can't slip in while the file is parsed.
  const [reading, setReading] = useState(false);
  const importing = archiveImport.running || reading;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
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
        .select('id, title, type, genre, metadata, external_id')
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
        external_id: item.external_id,
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
    if (importing) return;
    setBanner(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setBanner({ variant: 'error', message: 'This file is too large to be an archive (max 2 MB).' });
      return;
    }
    setReading(true);
    try {
      const { items, rejected } = parseArchive(await file.text());
      // Every rejected item is named, so a broken file can be fixed rather than guessed at.
      const skipped =
        rejected.length > 0
          ? ` Skipped ${rejected.length} invalid item${rejected.length === 1 ? '' : 's'}: ` +
            rejected
              .slice(0, 5)
              .map((r) => `#${r.position}${r.title ? ` "${r.title}"` : ''} (${r.reason})`)
              .join('; ') +
            (rejected.length > 5 ? `; and ${rejected.length - 5} more.` : '.')
          : '';
      if (items.length === 0) {
        setBanner({
          variant: 'error',
          message: rejected.length > 0 ? `No valid items found in this file.${skipped}` : 'This file contains no items.',
        });
        return;
      }
      const started = archiveImport.start({
        groupId: group.id,
        groupName: group.name,
        userId,
        items,
        invalid: rejected.length,
      });
      setBanner(
        started
          ? {
              variant: rejected.length > 0 ? 'error' : 'info',
              message: `Importing ${items.length} item${items.length === 1 ? '' : 's'} in the background. You can keep browsing — you'll be notified when it's done.${skipped}`,
            }
          : { variant: 'error', message: 'Another import is still running. Wait for it to finish.' }
      );
    } catch (err) {
      setBanner({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Could not read this file.',
      });
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm font-light leading-relaxed">
        Download the full catalogue of this group as a JSON file, or import one.
        Imported items are looked up online and filled in like a manual add;
        items already in the group are not duplicated, they only fill in missing details.
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
                Only <code>title</code> and <code>type</code> are required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 overflow-y-auto max-h-[65vh] pr-1">
              <section className="space-y-2">
                <h3 className="font-mono text-xs text-stone-500">Rules</h3>
                <ul className="space-y-2 text-sm text-stone-400 font-light leading-relaxed list-disc pl-5">
                  <li>
                    The file is a single JSON object with an <code className="text-stone-200">items</code> array.
                    Everything else (<code className="text-stone-200">format</code>,{' '}
                    <code className="text-stone-200">version</code>, <code className="text-stone-200">group</code>) is
                    optional on import.
                  </li>
                  <li>
                    One import takes at most {MAX_IMPORT_ITEMS} items (and a file of at most 2 MB). Split bigger
                    archives into several files. Only one import runs at a time.
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
                    <code className="text-stone-200">consuming</code> (In progress),{' '}
                    <code className="text-stone-200">completed</code> (Completed) or{' '}
                    <code className="text-stone-200">not_interested</code> (Not interested). It sets{' '}
                    <em className="not-italic text-stone-200">your own</em> status for the imported
                    item — never other members&apos; — and only on items the import creates. The labels work too (<code className="text-stone-200">&quot;Planned&quot;</code>,{' '}
                    <code className="text-stone-200">&quot;In progress&quot;</code>, <code className="text-stone-200">&quot;Completed&quot;</code>,{' '}
                    <code className="text-stone-200">&quot;Not interested&quot;</code>), in any case. A missing status means{' '}
                    <code className="text-stone-200">plan_to_consume</code> (Planned); any other value rejects the item.
                  </li>
                  <li>
                    <code className="text-stone-200">genre</code> is optional text,{' '}
                    <code className="text-stone-200">metadata</code> is an optional object. Unknown metadata keys are
                    ignored.
                  </li>
                  <li>
                    <code className="text-stone-200">external_id</code> or{' '}
                    <code className="text-stone-200">external_url</code> are optional and link the item to its
                    online source — see <em className="not-italic text-stone-200">Online links</em> below.
                  </li>
                  <li>
                    Titles are at most 300 characters, genres at most 255, and neither may contain control
                    characters.
                  </li>
                  <li>
                    Items that break any of these rules — an unknown status, a malformed id or link, a suspicious
                    title — are rejected whole and never imported. The rest of the file still imports, and every
                    rejected item is listed with its position and the reason.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs text-stone-500">
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
                <h3 className="font-mono text-xs text-stone-500">Online links</h3>
                <p className="text-sm text-stone-400 font-light leading-relaxed">
                  Give either the <code className="text-stone-200">external_id</code> or the page{' '}
                  <code className="text-stone-200">external_url</code> — one is enough, the other is recovered.
                  Exports write the id only. Each must match its type exactly as below — a link of the wrong type
                  (a TV page on a movie), another site, extra query parameters, or an id and link pointing to
                  different works reject the item. Movie and TV pages may keep their title suffix
                  (<code className="text-stone-200">/movie/693134-dune-part-two</code>).
                </p>
                <div className="border border-stone-800/50">
                  {LINK_RULES.map((rule) => (
                    <div
                      key={rule.type}
                      className="px-4 py-2.5 border-b border-stone-800/30 last:border-b-0 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                    >
                      <code className="font-mono text-xs shrink-0 sm:w-28" style={{ color: 'var(--color-accent)' }}>
                        {rule.type}
                      </code>
                      <span className="text-xs text-stone-400 font-light break-all">
                        {rule.id} <span className="text-stone-600">or</span> {rule.url}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs text-stone-500">How items are filled in</h3>
                <ul className="space-y-2 text-sm text-stone-400 font-light leading-relaxed list-disc pl-5">
                  <li>
                    <span className="text-stone-200">With a link:</span> details, tags and artwork are fetched from
                    the source, exactly like adding the item by hand.
                  </li>
                  <li>
                    <span className="text-stone-200">Title only:</span> the title is searched online. The year and
                    the director / author / developer in <code className="text-stone-200">metadata</code> help pick
                    the right result. With no convincing match, the item is imported as written, without a link.
                  </li>
                  <li>
                    Online data wins over the file&apos;s; the file only fills what the source doesn&apos;t know.
                  </li>
                  <li>
                    The import runs in the background, one online request at a time, so it can take a while on big
                    files. You can keep browsing; a notice shows the progress and a message tells you when it&apos;s
                    done. Closing the tab stops it — items already imported stay.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs text-stone-500">How merging works</h3>
                <p className="text-sm text-stone-400 font-light leading-relaxed">
                  An imported item that is already in the group — same online link, or same title (case-insensitive)
                  and type — is never duplicated. Instead, it fills in what the existing item is missing: an empty
                  genre, absent metadata keys, artwork, or its online link. Values already present, everyone&apos;s
                  statuses, and the title itself are never overwritten.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-mono text-xs text-stone-500">Example</h3>
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
