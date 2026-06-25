'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useExternalSearch } from '@/hooks/useExternalSearch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormBanner } from '@/components/ui/form-banner';
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
import { Plus, Link2, Search, X } from 'lucide-react';
import type { ExternalWork, MediaType, ItemStatus, MediaItem } from '@/types';
import { getStatusOptions } from '@/types';

interface Props {
  groupId: string;
  userId: string;
  activeType: MediaType | 'all';
  onAdded?: (item: MediaItem) => void;
}

const SELECT_COLUMNS =
  'id, group_id, title, type, status, genre, metadata, added_by, external_id, external_source, external_url, created_at, updated_at';

export function AddMediaDialog({ groupId, userId, activeType, onAdded }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ItemStatus>('plan_to_consume');
  const [type, setType] = useState<MediaType>(
    activeType === 'all' ? 'movie' : activeType
  );

  useEffect(() => {
    if (activeType !== 'all') {
      setType(activeType);
    }
  }, [activeType]);

  // Type-specific metadata fields
  const [director, setDirector] = useState('');
  const [creator, setCreator] = useState('');
  const [author, setAuthor] = useState('');
  const [developer, setDeveloper] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [seasons, setSeasons] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [platform, setPlatform] = useState('');
  const [genre, setGenre] = useState('');

  // Person/company links (director_url, author_url, …) captured from the enrich
  // call — not form fields, so they're tracked separately and merged on save.
  const [metaLinks, setMetaLinks] = useState<Record<string, string>>({});

  // External identification layer
  const [externalId, setExternalId] = useState<string | null>(null);
  const [externalSource, setExternalSource] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [externalTitle, setExternalTitle] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Throttled, quota-capped external search (debounce + cooldown + caps).
  // Disabled once an item is linked so a selection can't re-trigger calls.
  const {
    results: suggestions,
    isSearching: searching,
    limitReached,
    unavailable: searchFailed,
    callsRemaining,
    reset: resetSearch,
  } = useExternalSearch(type, title, open && !externalId);

  const showSuggestions = !externalId && suggestions.length > 0;

  function resetExternalLink() {
    setExternalId(null);
    setExternalSource(null);
    setExternalUrl(null);
    setExternalTitle(null);
    setMetaLinks({});
  }

  const URL_KEYS = ['director_url', 'creator_url', 'author_url', 'developer_url'] as const;

  function applyMetadata(metadata: Record<string, unknown>) {
    const m = metadata;
    setReleaseYear(
      m.release_year != null
        ? String(m.release_year)
        : m.publication_year != null
          ? String(m.publication_year)
          : ''
    );
    setDirector(typeof m.director === 'string' ? m.director : '');
    setCreator(typeof m.creator === 'string' ? m.creator : '');
    setAuthor(typeof m.author === 'string' ? m.author : '');
    setDeveloper(typeof m.developer === 'string' ? m.developer : '');
    setSeasons(m.seasons != null ? String(m.seasons) : '');
    setDurationMinutes(m.duration_minutes != null ? String(m.duration_minutes) : '');
    setPlatform(typeof m.platform === 'string' ? m.platform : '');

    const links: Record<string, string> = {};
    for (const k of URL_KEYS) {
      if (typeof m[k] === 'string') links[k] = m[k] as string;
    }
    setMetaLinks(links);
  }

  async function selectWork(work: ExternalWork) {
    setTitle(work.title);
    applyMetadata(work.metadata as Record<string, unknown>); // search-derived fields
    setExternalId(work.external_id);
    setExternalSource(work.external_source);
    setExternalUrl(work.external_url);
    setExternalTitle(work.title);
    // Linking disables the search hook (enabled = open && !externalId),
    // so no further search calls fire and the dropdown hides.

    // Enrich with full details (director/duration, developer, etc.) the search
    // list can't return. Merges over the search metadata; failures are silent.
    setEnriching(true);
    try {
      const res = await fetch(
        `/api/external-details?id=${encodeURIComponent(work.external_id)}`
      );
      if (res.ok) {
        const { metadata } = (await res.json()) as { metadata: Record<string, unknown> | null };
        if (metadata) {
          applyMetadata({ ...(work.metadata as Record<string, unknown>), ...metadata });
        }
      }
    } catch {
      // keep the search-derived fields; user can fill the rest manually
    } finally {
      setEnriching(false);
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    // Typing diverges from the linked work — drop the external link.
    if (externalId && value !== externalTitle) {
      resetExternalLink();
    }
  }

  function buildMetadata(): Record<string, unknown> {
    const year = releaseYear ? parseInt(releaseYear, 10) : undefined;
    // Only keep the link relevant to this type, and only if the matching name is
    // still present (so editing the name away doesn't leave a dangling link).
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

  function resetForm() {
    setTitle('');
    setDirector('');
    setCreator('');
    setAuthor('');
    setDeveloper('');
    setReleaseYear('');
    setSeasons('');
    setDurationMinutes('');
    setPlatform('');
    setGenre('');
    setStatus('plan_to_consume');
    resetSearch();
    resetExternalLink();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: insertedItem, error: insertError } = await supabase
      .from('media_items')
      .insert({
        group_id: groupId,
        added_by: userId,
        title: title.trim(),
        type,
        status,
        genre: genre.trim() || null,
        metadata: buildMetadata(),
        external_id: externalId,
        external_source: externalSource,
        external_url: externalUrl,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (insertError) {
      setError('Could not add this item right now. Please try again.');
      setLoading(false);
      return;
    }

    if (insertedItem && status === 'completed') {
      await supabase
        .from('consumption_records')
        .upsert(
          { user_id: userId, media_item_id: insertedItem.id },
          { onConflict: 'media_item_id,user_id' }
        );
    }

    resetForm();
    setOpen(false);

    if (insertedItem) {
      onAdded?.(insertedItem as MediaItem);
    }

    if (!onAdded) {
      router.refresh();
    }

    setLoading(false);
  }

  const statusOptions = getStatusOptions(type);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetSearch();
        else resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Add an item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Always shown. Defaults to the filter tab you opened it from, but
              remains changeable so any type can be added from any section. */}
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value as MediaType);
                // Switching type starts fresh: clear the title and every
                // type-specific field so nothing carries over from the old type.
                setTitle('');
                setDirector('');
                setCreator('');
                setAuthor('');
                setDeveloper('');
                setReleaseYear('');
                setSeasons('');
                setDurationMinutes('');
                setPlatform('');
                setGenre('');
                resetExternalLink();
              }}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="tv_series">TV Series</SelectItem>
                <SelectItem value="book">Book</SelectItem>
                <SelectItem value="video_game">Game</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500 pointer-events-none" />
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Search a title…"
                className="pl-9 pr-9"
                autoComplete="off"
                required
              />
              {searching && (
                <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto border border-stone-700 bg-stone-950 shadow-lg">
                  {suggestions.map((work) => (
                    <button
                      key={work.external_id}
                      type="button"
                      onClick={() => selectWork(work)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-900 transition-colors cursor-pointer border-b border-stone-800/60 last:border-b-0"
                    >
                      {work.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={work.image_url}
                          alt=""
                          className="h-10 w-7 shrink-0 object-cover bg-stone-800"
                        />
                      ) : (
                        <div className="h-10 w-7 shrink-0 bg-stone-800" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-stone-100">{work.title}</span>
                        {work.subtitle && (
                          <span className="block truncate text-[11px] font-mono text-stone-500">
                            {work.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Linked / manual / unavailable hint line */}
            {externalId ? (
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="inline-flex items-center gap-1 text-amber-500/90">
                  <Link2 className="h-3 w-3" />
                  Linked to {externalSource}
                </span>
                <button
                  type="button"
                  onClick={resetExternalLink}
                  className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-300 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  Unlink
                </button>
              </div>
            ) : limitReached ? (
              <p className="text-[11px] font-mono text-amber-500/80">
                Search limit reached for this item — please add it manually.
              </p>
            ) : searchFailed ? (
              <p className="text-[11px] font-mono text-stone-500">
                Search unavailable — you can still add this manually.
              </p>
            ) : searching ? (
              <p className="text-[11px] font-mono text-stone-500">Searching…</p>
            ) : (
              title.trim().length >= 2 &&
              suggestions.length === 0 && (
                <p className="text-[11px] font-mono text-stone-500">
                  No matches — fill the details below to add it manually.
                </p>
              )
            )}
            {/* Games (RAWG) are on the scarcest shared quota — show what's left. */}
            {type === 'video_game' && !externalId && callsRemaining <= 5 && (
              <p className="text-[10px] font-mono text-stone-600">
                {callsRemaining} game searches left for this item
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ItemStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="genre">Genre</Label>
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          {/* Type-specific metadata */}
          {type === 'movie' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="director">Director</Label>
                <Input id="director" value={director} onChange={(e) => setDirector(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="2024" min="1888" max="2099" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input id="duration" type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="optional" min="1" />
              </div>
            </div>
          )}

          {type === 'tv_series' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="creator">Creator</Label>
                <Input id="creator" value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="2024" min="1900" max="2099" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seasons">Seasons</Label>
                <Input id="seasons" type="number" inputMode="numeric" value={seasons} onChange={(e) => setSeasons(e.target.value)} placeholder="optional" min="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Input id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Netflix, HBO…" />
              </div>
            </div>
          )}

          {type === 'book' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="optional" min="1000" max="2099" />
              </div>
            </div>
          )}

          {type === 'video_game' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="developer">Developer</Label>
                <Input id="developer" value={developer} onChange={(e) => setDeveloper(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="optional" min="1950" max="2099" />
              </div>
            </div>
          )}

          {error && <FormBanner message={error} variant="error" />}

          <DialogFooter>
            <Button type="submit" disabled={loading || searching || enriching}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Adding...
                </span>
              ) : searching || enriching ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {enriching ? 'Loading details…' : 'Searching…'}
                </span>
              ) : (
                'Add item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
