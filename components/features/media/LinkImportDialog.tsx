'use client';

// ============================================================================
// Add from a post — paste an Instagram / TikTok / YouTube… link, get back
// every film, series, book and game it names, and keep the ones that are right.
//
// Its own dialog rather than a field in "Add an item": one post is often a
// list ("the best stop-motion films"), and a single-item form can only hold
// one of them.
// ============================================================================

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOffline } from '@/lib/offline';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { FormBanner } from '@/components/ui/form-banner';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogSheetBody,
  DialogSheetContent,
  DialogSheetFooter,
  DialogSheetHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CircleHelp, CopyCheck, Link2, X } from 'lucide-react';
import type { ExternalWork, ItemStatus, MediaItem, MediaType } from '@/types';
import { getTypeLabel } from '@/types';
import { cn } from '@/lib/utils';
import { MediaPoster } from './MediaPoster';
import { SELECT_COLUMNS } from './AddMediaDialog';

interface Props {
  groupId: string;
  userId: string;
  onAdded: (item: MediaItem & { status: ItemStatus }) => void;
  triggerClassName?: string;
}

interface Found {
  recognized: { type: MediaType; title: string; year?: number };
  /** The provider's match, or null — then it is added by name, unlinked. */
  work: ExternalWork | null;
  /** Same provider id already in this archive. Shown, never re-added. */
  existing: boolean;
}

const LINK_ERRORS: Record<string, string> = {
  unreadable: 'Could not read that link — is the post public?',
  not_recognized: 'No film, series, book or game found in that post.',
  rate_limited: 'Too many links at once — wait a minute.',
  not_configured: 'Link recognition is not set up on this server.',
};

/**
 * The "?" beside the title. Hover on a desk; a Radix tooltip never opens on
 * touch by itself, so it is controlled and a tap toggles it. A tap outside
 * closes it (Radix's own outside-press).
 */
function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="How adding from a post works"
            onClick={() => setOpen((o) => !o)}
            // Radix closes on pointerdown over the trigger; without this the
            // tap's own click would reopen it straight after.
            onPointerDown={(e) => e.preventDefault()}
            className="-m-1.5 cursor-pointer rounded-full p-1.5 text-stone-500 transition-colors hover:text-stone-200"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-72 space-y-1.5 px-3 py-2.5 font-sans text-[12.5px] leading-snug"
        >
          <p className="font-medium text-stone-100">Paste a link, get the titles.</p>
          <p className="text-stone-400">
            Copy the link of a post (Instagram, TikTok, YouTube, X, Reddit or a blog) that talks
            about films, series, books or games. We read its caption and picture and list every
            title it names.
          </p>
          <p className="text-stone-400">
            Remove the ones that are wrong with ×, then add the rest in one go. Titles already in
            the archive are skipped.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LinkImportDialog({ groupId, userId, onAdded, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [reading, setReading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const offline = useOffline();
  const { toast } = useToast();

  const toAdd = found?.filter((f) => !f.existing) ?? [];

  function reset() {
    setLink('');
    setError(null);
    setFound(null);
  }

  async function read() {
    const url = link.trim();
    if (!url || reading) return;
    setReading(true);
    setError(null);
    try {
      const res = await fetch(`/api/link-recognize?url=${encodeURIComponent(url)}`);
      const data = (await res.json()) as {
        error?: string;
        items?: { recognized: Found['recognized']; work: ExternalWork | null }[];
      };
      if (!res.ok || !data.items?.length) {
        setError(LINK_ERRORS[data.error ?? ''] ?? 'Could not recognise that link.');
        return;
      }

      // One indexed read for the whole list, same rule as the single add:
      // the same provider id in this group is the same work.
      const ids = data.items.flatMap((i) => (i.work ? [i.work.external_id] : []));
      const have = new Set<string>();
      if (ids.length) {
        const { data: rows } = await createClient()
          .from('media_items')
          .select('external_id')
          .eq('group_id', groupId)
          .in('external_id', ids);
        for (const r of rows ?? []) if (r.external_id) have.add(r.external_id);
      }
      setFound(
        data.items.map((i) => ({ ...i, existing: !!i.work && have.has(i.work.external_id) }))
      );
    } catch {
      setError('Could not recognise that link.');
    } finally {
      setReading(false);
    }
  }

  async function addAll() {
    if (toAdd.length === 0) return;
    setAdding(true);
    setError(null);

    // ponytail: search-level metadata only (no per-item details call) — the
    // item sheet fetches the full story on open anyway. Enrich here if the
    // list rows ever need director/runtime before the sheet is opened.
    const rows = toAdd.map(({ recognized: r, work }) => ({
      id: crypto.randomUUID(),
      group_id: groupId,
      added_by: userId,
      title: work?.title ?? r.title,
      type: work?.type ?? r.type,
      genre: work?.genre ?? null,
      metadata:
        work?.metadata ??
        (r.year ? { [r.type === 'book' ? 'publication_year' : 'release_year']: r.year } : {}),
      external_id: work?.external_id ?? null,
      external_source: work?.external_source ?? null,
      external_url: work?.external_url ?? null,
      image_url: work?.image_url ?? null,
    }));

    const { data, error: insertError } = await createClient()
      .from('media_items')
      .insert(rows)
      .select(SELECT_COLUMNS);
    setAdding(false);

    if (insertError || !data) {
      setError('Could not add these right now. Please try again.');
      return;
    }

    // Planned is the default — no status row to write.
    for (const item of data) onAdded({ ...(item as MediaItem), status: 'plan_to_consume' });
    toast({
      tone: 'success',
      message: (
        <>
          Added <b>{data.length}</b> {data.length === 1 ? 'item' : 'items'} to the archive
        </>
      ),
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          aria-label="Add from a post"
          disabled={offline}
          className={cn('gap-2', triggerClassName)}
        >
          <Link2 className="h-4 w-4" />
          <span className="hidden md:inline">From a post</span>
        </Button>
      </DialogTrigger>

      <DialogSheetContent open={open} onDismiss={() => setOpen(false)}>
        <DialogSheetHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Add from a post</DialogTitle>
            <HowItWorks />
          </div>
        </DialogSheetHeader>

        <DialogSheetBody className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void read();
            }}
          >
            <Input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError(null);
              }}
              placeholder="Paste an Instagram, TikTok, YouTube… link"
              aria-label="Post link"
              autoComplete="off"
              autoFocus
              disabled={reading || adding}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!link.trim() || reading || adding}
              className="shrink-0 gap-2"
            >
              {reading ? <Spinner className="h-3.5 w-3.5" /> : null}
              {reading ? 'Reading…' : 'Find'}
            </Button>
          </form>

          {found && (
            <ul className="divide-y divide-stone-800/60 border border-stone-800/60">
              {found.map((f, index) => {
                const title = f.work?.title ?? f.recognized.title;
                const type = f.work?.type ?? f.recognized.type;
                return (
                  <li
                    key={f.work?.external_id ?? `${type}:${title}`}
                    className={cn('flex items-center gap-3 p-2', f.existing && 'opacity-60')}
                  >
                    <MediaPoster
                      src={f.work?.thumb_url ?? f.work?.image_url}
                      type={type}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-stone-100">{title}</p>
                      <p className="truncate text-[11px] font-mono text-stone-500">
                        {getTypeLabel(type)}
                        {(f.work?.year ?? f.recognized.year) ? ` · ${f.work?.year ?? f.recognized.year}` : ''}
                        {f.work?.subtitle ? ` · ${f.work.subtitle}` : ''}
                      </p>
                      {f.existing ? (
                        <p className="flex items-center gap-1 text-[11px] font-mono text-warn-500/80">
                          <CopyCheck className="h-3 w-3" /> Already in this archive
                        </p>
                      ) : !f.work ? (
                        <p className="text-[11px] font-mono text-stone-600">
                          No match found — added by name only
                        </p>
                      ) : null}
                    </div>
                    {!f.existing && (
                      <button
                        type="button"
                        aria-label={`Remove ${title}`}
                        onClick={() => setFound(found.filter((_, i) => i !== index))}
                        className="p-2 text-stone-500 hover:text-stone-200 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {error && <FormBanner message={error} variant="error" />}
        </DialogSheetBody>

        {found && (
          <DialogSheetFooter>
            <Button
              type="button"
              className="w-full md:w-auto"
              disabled={toAdd.length === 0 || adding}
              onClick={() => void addAll()}
            >
              {adding ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Adding…
                </span>
              ) : toAdd.length === 0 ? (
                'Nothing new to add'
              ) : (
                `Add ${toAdd.length} ${toAdd.length === 1 ? 'item' : 'items'}`
              )}
            </Button>
          </DialogSheetFooter>
        )}
      </DialogSheetContent>
    </Dialog>
  );
}
