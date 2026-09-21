'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useExternalSearch } from '@/hooks/useExternalSearch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { Plus, Link2, Search, X, CopyCheck } from 'lucide-react';
import type { ExternalWork, MediaType, ItemStatus, MediaItem } from '@/types';
import { getStatusOptions } from '@/types';
import {
  cn,
  formatRelativeDate,
  parsePeople,
  parseTags,
  peopleFields,
  peopleValue,
  personLinksFrom,
  safeImageUrl,
  serializeTags,
} from '@/lib/utils';
import { MediaPoster, PosterGlow } from './MediaPoster';
import type { PersonKey } from '@/lib/utils';

interface Props {
  groupId: string;
  userId: string;
  activeType: MediaType | 'all';
  /**
   * 'bar'  — a labelled button that lives in the archive toolbar (desktop).
   * 'fab'  — a disc pinned to the corner of the screen (touch).
   *
   * The disc is rendered through a PORTAL. `position: fixed` resolves against
   * the nearest ancestor that has a transform, a filter or a backdrop-filter,
   * not against the viewport — and this app has a page transition that
   * animates one and a sticky toolbar that used to blur another. Pinned to the
   * body, the button is pinned to the screen, which is the only thing it was
   * ever supposed to be pinned to.
   */
  variant?: 'bar' | 'fab';
  /** Receives the inserted item plus the creator's own (per-member) status. */
  onAdded?: (item: MediaItem & { status: ItemStatus }) => void;
}

const SELECT_COLUMNS =
  'id, group_id, title, type, genre, metadata, added_by, external_id, external_source, external_url, image_url, created_at, updated_at';

/**
 * Something already in this archive that the thing being added looks like.
 *
 * TWO KINDS, because they deserve two different answers:
 *
 *   'exact'   — the same provider id. `external_id` is stable and identical
 *               across every group for the same work (DATA_MODEL § 3.5), so
 *               this is not a resemblance, it is the same film. Blocked.
 *
 *   'similar' — the same title and the same kind, but a different id or none
 *               at all. Dune (1984) and Dune (2021) are both movies called
 *               Dune and are not the same thing; so are a book and its
 *               re-issue. Warned about once, then allowed.
 */
interface ExistingItem {
  kind: 'exact' | 'similar';
  id: string;
  title: string;
  type: MediaType;
  imageUrl: string | null;
  createdAt: string;
  /** Who put it there. Null when that profile could not be read. */
  addedBy: string | null;
}

/**
 * `%` and `_` are wildcards to LIKE, and a title is allowed to contain both
 * ("50% off", "Hard_Reset"). Escaped with the default `\`, they match
 * themselves.
 */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function AddMediaDialog({
  groupId,
  userId,
  activeType,
  variant = 'bar',
  onAdded,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The portaled trigger can only mount once the document exists.
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ItemStatus>('plan_to_consume');
  const [type, setType] = useState<MediaType>(
    activeType === 'all' ? 'movie' : activeType
  );

  useEffect(() => setMounted(true), []);

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
  const [tags, setTags] = useState<string[]>([]);

  // Person/company pages captured from the enrich call, keyed by lowercased
  // name — not form fields, so they're tracked separately and re-attached on
  // save. Keyed by NAME (not position) so editing a name away simply drops its
  // link instead of leaving it pointing at somebody else.
  const [personLinks, setPersonLinks] = useState<Record<string, string>>({});

  // External identification layer
  const [externalId, setExternalId] = useState<string | null>(null);
  const [externalSource, setExternalSource] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [externalTitle, setExternalTitle] = useState<string | null>(null);
  // Artwork captured from the provider. We store the LINK only — the bytes stay
  // on the provider's CDN — and the member can drop it before saving.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // What "Remove artwork" took away, kept so the member can put it back without
  // spending another provider call.
  const [droppedImage, setDroppedImage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** What the archive already has that this looks like. Cleared by any edit. */
  const [existing, setExisting] = useState<ExistingItem | null>(null);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();
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

  /**
   * Any edit to what is being added makes the last answer stale — the check is
   * about THIS title, of THIS kind, linked to THIS work. Left standing, a
   * banner would go on accusing a title the member has already changed.
   */
  function clearExistingCheck() {
    setExisting(null);
  }

  function resetExternalLink() {
    setExternalId(null);
    setExternalSource(null);
    setExternalUrl(null);
    setExternalTitle(null);
    setImageUrl(null);
    setDroppedImage(null);
    setPersonLinks({});
  }

  function applyMetadata(metadata: Record<string, unknown>) {
    const m = metadata;
    setReleaseYear(
      m.release_year != null
        ? String(m.release_year)
        : m.publication_year != null
          ? String(m.publication_year)
          : ''
    );
    // People fields hold every credited name, comma-separated.
    setDirector(peopleValue(m, 'director'));
    setCreator(peopleValue(m, 'creator'));
    setAuthor(peopleValue(m, 'author'));
    setDeveloper(peopleValue(m, 'developer'));
    setSeasons(m.seasons != null ? String(m.seasons) : '');
    setDurationMinutes(m.duration_minutes != null ? String(m.duration_minutes) : '');
    setPlatform(typeof m.platform === 'string' ? m.platform : '');
    setPersonLinks(personLinksFrom(m));
  }

  async function selectWork(work: ExternalWork) {
    setTitle(work.title);
    clearExistingCheck();
    applyMetadata(work.metadata as Record<string, unknown>); // search-derived fields
    if (work.genre) setTags(parseTags(work.genre)); // search-derived tags
    setExternalId(work.external_id);
    setExternalSource(work.external_source);
    setExternalUrl(work.external_url);
    setExternalTitle(work.title);
    // The search payload already carries the artwork — no extra call needed.
    setImageUrl(safeImageUrl(work.image_url));
    setDroppedImage(null);
    // Linking disables the search hook (enabled = open && !externalId),
    // so no further search calls fire and the dropdown hides.

    // Enrich with full details (director/duration, developer, genre, …) the
    // search list can't return. Merges over the search metadata; failures silent.
    setEnriching(true);
    try {
      const res = await fetch(
        `/api/external-details?id=${encodeURIComponent(work.external_id)}`
      );
      if (res.ok) {
        const { metadata, genre, image_url } = (await res.json()) as {
          metadata: Record<string, unknown> | null;
          genre: string | null;
          image_url: string | null;
        };
        if (metadata) {
          applyMetadata({ ...(work.metadata as Record<string, unknown>), ...metadata });
        }
        if (genre) setTags(parseTags(genre));
        // Only ever an upgrade: a detail call without artwork keeps the
        // search-derived poster rather than clearing it.
        const detailImage = safeImageUrl(image_url);
        if (detailImage) setImageUrl(detailImage);
      }
    } catch {
      // keep the search-derived fields; user can fill the rest manually
    } finally {
      setEnriching(false);
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    clearExistingCheck();
    // Typing diverges from the linked work — drop the external link.
    if (externalId && value !== externalTitle) {
      resetExternalLink();
    }
  }

  /** Names + their known pages for one credit role, ready to store. */
  function credits(key: PersonKey, field: string): Record<string, unknown> {
    return peopleFields(key, parsePeople(field), (name) => personLinks[name.toLowerCase()]);
  }

  function buildMetadata(): Record<string, unknown> {
    const year = releaseYear ? parseInt(releaseYear, 10) : undefined;
    switch (type) {
      case 'movie':
        return {
          ...credits('director', director),
          ...(year ? { release_year: year } : {}),
          ...(durationMinutes ? { duration_minutes: parseInt(durationMinutes, 10) } : {}),
        };
      case 'tv_series':
        return {
          ...credits('creator', creator),
          ...(year ? { release_year: year } : {}),
          ...(seasons ? { seasons: parseInt(seasons, 10) } : {}),
          ...(platform ? { platform } : {}),
        };
      case 'book':
        return {
          ...credits('author', author),
          ...(year ? { publication_year: year } : {}),
        };
      case 'video_game':
        return {
          ...credits('developer', developer),
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
    setTags([]);
    setStatus('plan_to_consume');
    resetSearch();
    resetExternalLink();
    clearExistingCheck();
  }

  /**
   * Does this archive already have it?
   *
   * Asked HERE, against the database, rather than against the list the page
   * happens to be holding: the archive is shared, and the friend who added
   * this same film four minutes ago is exactly the case worth catching. Both
   * lookups are indexed (`idx_media_items_external_id`,
   * `idx_media_items_group_id`), and both run only on the press of the button
   * — never while typing, which would be a query per keystroke for an answer
   * nobody has asked for yet.
   */
  async function findExisting(): Promise<ExistingItem | null> {
    const name = title.trim();
    if (!name) return null;

    const supabase = createClient();
    const columns = 'id, title, type, image_url, added_by, created_at';
    const inThisGroup = () =>
      supabase.from('media_items').select(columns).eq('group_id', groupId);

    // 1. The same work, said by the provider. Not a resemblance.
    if (externalId) {
      const { data } = await inThisGroup().eq('external_id', externalId).limit(1).maybeSingle();
      if (data) return describe('exact', data);
    }

    // 2. The same name and the same kind. `ilike` with no wildcards left in it
    //    is a case-insensitive exact match, so "dune" finds "Dune".
    const { data } = await inThisGroup()
      .eq('type', type)
      .ilike('title', likeLiteral(name))
      .limit(1)
      .maybeSingle();
    if (data) return describe('similar', data);

    return null;
  }

  /** Puts a name to the row that was found. One extra read, only on a hit. */
  async function describe(
    kind: ExistingItem['kind'],
    row: {
      id: string;
      title: string;
      type: MediaType;
      image_url: string | null;
      added_by: string;
      created_at: string;
    },
  ): Promise<ExistingItem> {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', row.added_by)
      .maybeSingle();

    return {
      kind,
      id: row.id,
      title: row.title,
      type: row.type,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      addedBy: profile?.nickname ?? null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addItem(false);
  }

  /**
   * `force` is what the notice's own "Add anyway" presses.
   *
   * The decision lives in the notice rather than in the footer, because the
   * notice is where the evidence is — the poster, the name, who put it there.
   * A footer button that quietly changed meaning after a failed press asked
   * people to remember a rule; two buttons under the thing they are about to
   * duplicate ask them nothing.
   */
  async function addItem(force: boolean) {
    setError(null);

    // The check runs before anything is written, and its own failure is not
    // allowed to stop an add: a duplicate is an annoyance, a member who cannot
    // add anything because a lookup timed out is a broken archive.
    if (!force) {
      setChecking(true);
      let found: ExistingItem | null = null;
      try {
        found = await findExisting();
      } catch {
        found = null;
      }
      setChecking(false);

      if (found) {
        setExisting(found);
        return;
      }
    }

    setLoading(true);

    // Read before the form is reset: the confirmation names the title, and by
    // the time it is raised the field is already empty for the next one.
    const addedTitle = title.trim();
    const supabase = createClient();
    const { data: insertedItem, error: insertError } = await supabase
      .from('media_items')
      .insert({
        group_id: groupId,
        added_by: userId,
        title: title.trim(),
        type,
        genre: serializeTags(tags) || null,
        metadata: buildMetadata(),
        external_id: externalId,
        external_source: externalSource,
        external_url: externalUrl,
        image_url: imageUrl,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (insertError) {
      setError('Could not add this item right now. Please try again.');
      setLoading(false);
      return;
    }

    // Status is per-member (item_statuses), never on the shared item. A missing
    // row already means 'plan_to_consume', so only write when it differs.
    //
    // BOTH RESULTS ARE READ. These used to be fired and forgotten, so a status
    // that the database refused was still reported as saved and still drawn on
    // the new row — right until the next reload put it back to Planned. An add
    // is not failed by a status that would not stick, but it is not allowed to
    // lie about it either: the archive is told the status that actually landed,
    // and so is the member.
    let statusSaved = true;

    if (insertedItem && status !== 'plan_to_consume') {
      const { error: statusError } = await supabase
        .from('item_statuses')
        .upsert(
          { media_item_id: insertedItem.id, user_id: userId, status },
          { onConflict: 'media_item_id,user_id' }
        );
      if (statusError) statusSaved = false;
    }

    // 'Completed' is the one status the rest of the group can see, and it is
    // read off consumption_records — so it needs the bare row there too, or the
    // item would say finished to its owner and unfinished to everyone else.
    if (insertedItem && statusSaved && status === 'completed') {
      const { error: recordError } = await supabase
        .from('consumption_records')
        .upsert(
          { user_id: userId, media_item_id: insertedItem.id },
          { onConflict: 'media_item_id,user_id' }
        );
      if (recordError) statusSaved = false;
    }

    const savedStatus: ItemStatus = statusSaved ? status : 'plan_to_consume';

    resetForm();
    setOpen(false);

    if (insertedItem) {
      onAdded?.({ ...(insertedItem as MediaItem), status: savedStatus });
    }

    // The dialog closes on success, so the confirmation has to live outside it.
    toast({
      tone: statusSaved ? 'success' : 'neutral',
      message: statusSaved ? (
        <>
          Added <b>{addedTitle}</b> to the archive
        </>
      ) : (
        <>
          Added <b>{addedTitle}</b>, but your status did not save — set it on the row.
        </>
      ),
    });

    if (!onAdded) {
      router.refresh();
    }

    setLoading(false);
  }

  const statusOptions = getStatusOptions();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetSearch();
        else resetForm();
      }}
    >
      {variant === 'fab' ? (
        mounted ? (
          createPortal(
            <DialogTrigger asChild>
              <Button
                aria-label="Add item"
                // Hard into the corner, and clear of the home indicator / rounded
                // display cutouts that env() reports on a phone.
                style={{
                  bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
                  right: 'calc(1rem + env(safe-area-inset-right, 0px))',
                }}
                className="fixed z-40 h-14 w-14 rounded-full p-0 shadow-[var(--shadow-3)] md:hidden"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>,
            document.body,
          )
        ) : null
      ) : (
        <DialogTrigger asChild>
          <Button aria-label="Add item" className="hidden gap-2 md:inline-flex">
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </DialogTrigger>
      )}
      {/* Shaped like the item sheet: on a phone it rises from the bottom edge
          and the form scrolls inside it, so the fields a TV series or a linked
          work adds can never push the submit button off the screen. */}
      <DialogSheetContent open={open} onDismiss={() => setOpen(false)}>
        <DialogSheetHeader>
          <DialogTitle>Add an item</DialogTitle>
        </DialogSheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogSheetBody className="space-y-4">
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
                  setTags([]);
                  resetExternalLink();
                  clearExistingCheck();
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
                        <MediaPoster
                          src={work.thumb_url ?? work.image_url}
                          type={work.type}
                          size="xs"
                        />
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
                /* Linked: show what was actually captured — artwork included — so
                   the poster is confirmed here rather than being a surprise in the
                   list after saving. */
                <div className="flex items-start gap-3 border border-stone-800/60 bg-stone-900/30 p-2">
                  <MediaPoster src={imageUrl} type={type} size="lg" />
                  <div className="min-w-0 flex-1 space-y-1 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-amber-500/90">
                      <Link2 className="h-3 w-3" />
                      Linked to {externalSource}
                    </span>
                    {imageUrl ? (
                      <>
                        <p className="text-stone-500">Artwork from {externalSource}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setDroppedImage(imageUrl);
                            setImageUrl(null);
                          }}
                          className="text-stone-600 underline decoration-dotted underline-offset-2 hover:text-stone-300 cursor-pointer"
                        >
                          Remove artwork
                        </button>
                      </>
                    ) : droppedImage ? (
                      <>
                        <p className="text-stone-600">Artwork removed</p>
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl(droppedImage);
                            setDroppedImage(null);
                          }}
                          className="text-stone-500 underline decoration-dotted underline-offset-2 hover:text-amber-500 cursor-pointer"
                        >
                          Restore artwork
                        </button>
                      </>
                    ) : (
                      <p className="text-stone-600">No artwork available</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={resetExternalLink}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 hover:text-stone-300 cursor-pointer"
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
                title.trim().length >= 1 &&
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
              {type === 'movie' && (
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input id="duration" type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="optional" min="1" />
                </div>
              )}
            </div>

            {/* Type-specific metadata */}
            {type === 'movie' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="director">Director(s)</Label>
                  <Input id="director" value={director} onChange={(e) => setDirector(e.target.value)} placeholder="comma-separated" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="2024" min="1888" max="2099" />
                </div>
              </div>
            )}

            {type === 'tv_series' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="creator">Creator(s)</Label>
                  <Input id="creator" value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="comma-separated" />
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
                  <Label htmlFor="author">Author(s)</Label>
                  <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="comma-separated for several authors" />
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
                  <Label htmlFor="developer">Developer(s)</Label>
                  <Input id="developer" value={developer} onChange={(e) => setDeveloper(e.target.value)} placeholder="comma-separated" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" inputMode="numeric" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} placeholder="optional" min="1950" max="2099" />
                </div>
              </div>
            )}

            {/* Tags last: full-width so the chips have the whole dialog to grow into. */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <TagInput id="tags" value={tags} onChange={setTags} placeholder="anime, rpg, co-op…" />
            </div>

            {/* Sits at the foot of the form, next to the button that raised
                it — a warning at the top of a scrolled sheet is a warning
                nobody sees. */}
            {existing ? (
              <ExistingItemNotice
                item={existing}
                busy={loading}
                onStartOver={resetForm}
                onAddAnyway={() => void addItem(true)}
              />
            ) : null}

            {error && <FormBanner message={error} variant="error" />}
          </DialogSheetBody>

          <DialogSheetFooter>
            <Button
              type="submit"
              className="w-full md:w-auto"
              // Closed while a notice stands, whichever kind. The two answers
              // to it are in the notice, next to what raised them.
              disabled={loading || checking || searching || enriching || !!existing}
            >
              {loading || checking ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {checking ? 'Checking the archive…' : 'Adding...'}
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
          </DialogSheetFooter>
        </form>
      </DialogSheetContent>
    </Dialog>
  );
}

/**
 * What the archive already has, shown rather than described.
 *
 * A line of text saying "this already exists" is a claim the member has to take
 * on trust. The poster, the title, the name of whoever put it there and how
 * long ago answers the only question they actually have: is that the same one
 * I mean, and how did it get here.
 *
 * It is built like the archive's own rows — a tinted strip for what it is, the
 * item itself underneath, and the artwork glowing through the back of it — so
 * it reads as a piece of the archive answering back, not as a form error.
 *
 * BOTH ANSWERS LIVE HERE, next to the evidence. The footer button is closed
 * while this is up: a button that quietly changes meaning after a failed press
 * asks people to remember a rule, and two buttons under the thing they are
 * about to duplicate ask them nothing.
 */
function ExistingItemNotice({
  item,
  busy,
  onStartOver,
  onAddAnyway,
}: {
  item: ExistingItem;
  busy: boolean;
  onStartOver: () => void;
  onAddAnyway: () => void;
}) {
  const exact = item.kind === 'exact';
  const box = useRef<HTMLDivElement>(null);

  /**
   * Bring it into view.
   *
   * The form scrolls inside the sheet and this lands at the bottom of it, so on
   * a filled-in form — or any phone — the answer to the button you just pressed
   * can appear entirely below the fold, and the press reads as nothing having
   * happened. 'nearest' moves the least amount that makes it visible, so a
   * notice already on screen does not jump. Re-run on a new verdict, not just
   * on mount.
   */
  useEffect(() => {
    box.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [item.id, item.kind]);

  return (
    <div
      ref={box}
      role="alert"
      className={cn(
        'relative isolate animate-fade-in overflow-hidden rounded-[var(--radius-md)] border bg-stone-900/70',
        exact ? 'border-red-500/40' : 'border-amber-500/40',
      )}
    >
      {/* The item tints its own warning, the same way its row does. */}
      <PosterGlow src={item.imageUrl} shape="card" className="opacity-70" />

      <div className="relative">
        <p
          className={cn(
            'flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.09em]',
            exact
              ? 'border-red-500/25 bg-red-500/[0.12] text-red-300'
              : 'border-amber-500/25 bg-amber-500/[0.12] text-amber-300',
          )}
        >
          <CopyCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {exact ? 'Already in this archive' : 'Same name, different entry'}
        </p>

        <div className="flex gap-3 p-3">
          <MediaPoster src={item.imageUrl} type={item.type} size="md" className="shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-stone-50">
              {item.title}
            </p>
            <p className="mt-0.5 text-[11.5px] text-stone-500">
              {item.addedBy ? `Added by ${item.addedBy}` : 'Added'} ·{' '}
              {formatRelativeDate(item.createdAt)}
            </p>

            {/* Safe one first. The override is never the white button — the
                archive is not encouraging it, only allowing it. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={onStartOver}
              >
                Start over
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onAddAnyway}
                className={cn(
                  'gap-1.5',
                  exact
                    ? 'border-red-500/40 text-red-200 hover:bg-red-500/10 hover:text-red-100'
                    : 'border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100',
                )}
              >
                {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
                Add anyway
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
