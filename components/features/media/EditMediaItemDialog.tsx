'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useExternalSearch } from '@/hooks/useExternalSearch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormBanner } from '@/components/ui/form-banner';
import { ExternalLink, Link2, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import type { ExternalWork, ItemStatus, MediaItemWithDetails, MediaType } from '@/types';
import { getStatusOptions } from '@/types';
import { parseTags, serializeTags } from '@/lib/utils';

interface Props {
  item: MediaItemWithDetails;
  userId: string;
  onUpdated: (item: MediaItemWithDetails) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditMediaItemDialog({ item, userId, onUpdated, children, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [title, setTitle] = useState(item.title);
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [tags, setTags] = useState<string[]>(parseTags(item.genre));

  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const [director, setDirector] = useState(String(metadata.director ?? ''));
  const [creator, setCreator] = useState(String(metadata.creator ?? ''));
  const [author, setAuthor] = useState(String(metadata.author ?? ''));
  const [developer, setDeveloper] = useState(String(metadata.developer ?? ''));
  const [releaseYear, setReleaseYear] = useState(
    String(metadata.release_year ?? metadata.publication_year ?? '')
  );
  const [seasons, setSeasons] = useState(String(metadata.seasons ?? ''));
  const [durationMinutes, setDurationMinutes] = useState(String(metadata.duration_minutes ?? ''));
  const [platform, setPlatform] = useState(String(metadata.platform ?? ''));

  // Person/company links (director_url, author_url, …). Seeded from the existing
  // item so an edit doesn't drop them, updated on (re)link.
  const URL_KEYS = ['director_url', 'creator_url', 'author_url', 'developer_url'] as const;
  const [metaLinks, setMetaLinks] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const k of URL_KEYS) {
      if (typeof metadata[k] === 'string') seed[k] = metadata[k] as string;
    }
    return seed;
  });

  // External identification layer
  const [externalId, setExternalId] = useState<string | null>(item.external_id);
  const [externalSource, setExternalSource] = useState<string | null>(item.external_source);
  const [externalUrl, setExternalUrl] = useState<string | null>(item.external_url);

  // Inline "link to external" search (only shown when not currently linked).
  // Same throttled, quota-capped hook the Add dialog uses.
  const [linkQuery, setLinkQuery] = useState('');
  const {
    results: suggestions,
    isSearching: searching,
    limitReached,
    unavailable: searchFailed,
    reset: resetSearch,
  } = useExternalSearch(item.type, linkQuery, open && !externalId);
  const showSuggestions = !externalId && suggestions.length > 0;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const statusOptions = useMemo(() => getStatusOptions(), []);

  function applyWorkMetadata(m: Record<string, unknown>) {
    if (m.release_year != null) setReleaseYear(String(m.release_year));
    else if (m.publication_year != null) setReleaseYear(String(m.publication_year));
    if (typeof m.director === 'string') setDirector(m.director);
    if (typeof m.creator === 'string') setCreator(m.creator);
    if (typeof m.author === 'string') setAuthor(m.author);
    if (typeof m.developer === 'string') setDeveloper(m.developer);
    if (m.seasons != null) setSeasons(String(m.seasons));
    if (m.duration_minutes != null) setDurationMinutes(String(m.duration_minutes));
    if (typeof m.platform === 'string') setPlatform(m.platform);

    setMetaLinks((prev) => {
      const next = { ...prev };
      for (const k of URL_KEYS) {
        if (typeof m[k] === 'string') next[k] = m[k] as string;
      }
      return next;
    });
  }

  async function linkToWork(work: ExternalWork) {
    setTitle(work.title);
    applyWorkMetadata(work.metadata as Record<string, unknown>);
    if (work.genre) setTags(parseTags(work.genre)); // search-derived tags
    setExternalId(work.external_id);
    setExternalSource(work.external_source);
    setExternalUrl(work.external_url);
    // Setting externalId disables the search hook; clear the query box.
    setLinkQuery('');
    resetSearch();

    // Enrich with full details (director/duration, developer, etc.).
    setEnriching(true);
    try {
      const res = await fetch(
        `/api/external-details?id=${encodeURIComponent(work.external_id)}`
      );
      if (res.ok) {
        const { metadata, genre } = (await res.json()) as {
          metadata: Record<string, unknown> | null;
          genre: string | null;
        };
        if (metadata) applyWorkMetadata(metadata);
        if (genre) setTags(parseTags(genre));
      }
    } catch {
      // keep the search-derived fields
    } finally {
      setEnriching(false);
    }
  }

  function unlink() {
    setExternalId(null);
    setExternalSource(null);
    setExternalUrl(null);
    setMetaLinks({});
  }

  function buildMetadata(type: MediaType): Record<string, unknown> {
    const year = releaseYear ? parseInt(releaseYear, 10) : undefined;
    const linkFor = (nameField: string, key: string) =>
      nameField && metaLinks[key] ? { [key]: metaLinks[key] } : {};

    switch (type) {
      case 'movie':
        return {
          ...(director ? { director } : {}),
          ...linkFor(director, 'director_url'),
          ...(year ? { release_year: year } : {}),
          ...(durationMinutes ? { duration_minutes: parseInt(durationMinutes, 10) } : {}),
        };
      case 'tv_series':
        return {
          ...(creator ? { creator } : {}),
          ...linkFor(creator, 'creator_url'),
          ...(year ? { release_year: year } : {}),
          ...(seasons ? { seasons: parseInt(seasons, 10) } : {}),
          ...(platform ? { platform } : {}),
        };
      case 'book':
        return {
          ...(author ? { author } : {}),
          ...linkFor(author, 'author_url'),
          ...(year ? { publication_year: year } : {}),
        };
      case 'video_game':
        return {
          ...(developer ? { developer } : {}),
          ...linkFor(developer, 'developer_url'),
          ...(year ? { release_year: year } : {}),
        };
      default:
        return {};
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from('media_items')
      .update({
        title: title.trim(),
        genre: serializeTags(tags) || null,
        metadata: buildMetadata(item.type),
        external_id: externalId,
        external_source: externalSource,
        external_url: externalUrl,
      })
      .eq('id', item.id)
      .select('id, group_id, title, type, genre, metadata, added_by, external_id, external_source, external_url, created_at, updated_at')
      .single();

    if (updateError) {
      setError('Could not save this item right now. Please try again.');
      setLoading(false);
      return;
    }

    // Status is per-member: only the editor's own item_statuses row changes.
    await supabase
      .from('item_statuses')
      .upsert(
        { media_item_id: item.id, user_id: userId, status },
        { onConflict: 'media_item_id,user_id' }
      );

    if (status === 'completed') {
      await supabase
        .from('consumption_records')
        .upsert(
          { user_id: userId, media_item_id: item.id },
          { onConflict: 'media_item_id,user_id' }
        );
    } else {
      await supabase
        .from('consumption_records')
        .delete()
        .eq('user_id', userId)
        .eq('media_item_id', item.id);
    }

    const merged: MediaItemWithDetails = {
      ...(data as Omit<MediaItemWithDetails, 'status'>),
      status,
      added_by_profile: item.added_by_profile,
      consumption_records: item.consumption_records,
    };

    onUpdated(merged);
    setOpen(false);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`title-${item.id}`}>Title</Label>
            <Input
              id={`title-${item.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            {externalId ? (
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="inline-flex items-center gap-1 text-amber-500/90">
                  <Link2 className="h-3 w-3" />
                  Linked to {externalSource}
                  {externalUrl && (
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center text-stone-500 hover:text-amber-500 cursor-pointer"
                      aria-label="Open external page"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </span>
                <button
                  type="button"
                  onClick={unlink}
                  className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-300 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  Unlink
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500 pointer-events-none" />
                <Input
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  placeholder="Link to an external work…"
                  className="pl-9 pr-9 h-9 text-sm"
                  autoComplete="off"
                />
                {searching && (
                  <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />
                )}
                {(limitReached || searchFailed) && (
                  <p className="mt-1 text-[11px] font-mono text-stone-500">
                    {limitReached
                      ? 'Search limit reached — edit the fields manually.'
                      : 'Search unavailable right now.'}
                  </p>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto border border-stone-700 bg-stone-950 shadow-lg">
                    {suggestions.map((work) => (
                      <button
                        key={work.external_id}
                        type="button"
                        onClick={() => linkToWork(work)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-900 transition-colors cursor-pointer border-b border-stone-800/60 last:border-b-0"
                      >
                        {work.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={work.image_url} alt="" className="h-10 w-7 shrink-0 object-cover bg-stone-800" />
                        ) : (
                          <div className="h-10 w-7 shrink-0 bg-stone-800" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-stone-100">{work.title}</span>
                          {work.subtitle && (
                            <span className="block truncate text-[11px] font-mono text-stone-500">{work.subtitle}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`status-${item.id}`}>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ItemStatus)}>
                <SelectTrigger id={`status-${item.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {item.type === 'movie' && (
              <div className="space-y-2">
                <Label htmlFor={`duration-${item.id}`}>Duration (min)</Label>
                <Input id={`duration-${item.id}`} type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} min="1" placeholder="optional" />
              </div>
            )}
          </div>

          {item.type === 'movie' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`director-${item.id}`}>Director</Label>
                <Input id={`director-${item.id}`} value={director} onChange={(e) => setDirector(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`year-${item.id}`}>Year</Label>
                <Input id={`year-${item.id}`} type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} min="1888" max="2099" placeholder="optional" />
              </div>
            </div>
          )}

          {item.type === 'tv_series' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`creator-${item.id}`}>Creator</Label>
                <Input id={`creator-${item.id}`} value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`year-${item.id}`}>Year</Label>
                <Input id={`year-${item.id}`} type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} min="1900" max="2099" placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`seasons-${item.id}`}>Seasons</Label>
                <Input id={`seasons-${item.id}`} type="number" inputMode="numeric" value={seasons} onChange={(e) => setSeasons(e.target.value)} min="1" placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`platform-${item.id}`}>Platform</Label>
                <Input id={`platform-${item.id}`} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="optional" />
              </div>
            </div>
          )}

          {item.type === 'book' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`author-${item.id}`}>Author</Label>
                <Input id={`author-${item.id}`} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`year-${item.id}`}>Publication Year</Label>
                <Input id={`year-${item.id}`} type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} min="1000" max="2099" placeholder="optional" />
              </div>
            </div>
          )}

          {item.type === 'video_game' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`developer-${item.id}`}>Developer</Label>
                <Input id={`developer-${item.id}`} value={developer} onChange={(e) => setDeveloper(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`year-${item.id}`}>Year</Label>
                <Input id={`year-${item.id}`} type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} min="1950" max="2099" placeholder="optional" />
              </div>
            </div>
          )}

          {/* Tags last: full-width so the chips have the whole dialog to grow into. */}
          <div className="space-y-2">
            <Label htmlFor={`tags-${item.id}`}>Tags</Label>
            <TagInput
              id={`tags-${item.id}`}
              value={tags}
              onChange={setTags}
              placeholder="anime, rpg, co-op…"
            />
          </div>

          {error && <FormBanner message={error} variant="error" />}

          <DialogFooter>
            <Button type="submit" disabled={loading || searching || enriching}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Saving...
                </span>
              ) : searching || enriching ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {enriching ? 'Loading details…' : 'Searching…'}
                </span>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
