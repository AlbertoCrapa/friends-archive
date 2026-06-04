'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
import type { ItemStatus, MediaItemWithDetails, MediaType } from '@/types';
import { getStatusOptions } from '@/types';

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
  const [genre, setGenre] = useState(item.genre ?? '');

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

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const statusOptions = useMemo(() => getStatusOptions(item.type), [item.type]);

  function buildMetadata(type: MediaType): Record<string, unknown> {
    const year = releaseYear ? parseInt(releaseYear, 10) : undefined;

    switch (type) {
      case 'movie':
        return {
          ...(director ? { director } : {}),
          ...(year ? { release_year: year } : {}),
          ...(durationMinutes ? { duration_minutes: parseInt(durationMinutes, 10) } : {}),
        };
      case 'tv_series':
        return {
          ...(creator ? { creator } : {}),
          ...(year ? { release_year: year } : {}),
          ...(seasons ? { seasons: parseInt(seasons, 10) } : {}),
          ...(platform ? { platform } : {}),
        };
      case 'book':
        return {
          ...(author ? { author } : {}),
          ...(year ? { publication_year: year } : {}),
        };
      case 'video_game':
        return {
          ...(developer ? { developer } : {}),
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
        status,
        genre: genre.trim() || null,
        metadata: buildMetadata(item.type),
      })
      .eq('id', item.id)
      .select('id, group_id, title, type, status, genre, metadata, added_by, created_at, updated_at')
      .single();

    if (updateError) {
      setError('Could not save this item right now. Please try again.');
      setLoading(false);
      return;
    }

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
      ...(data as MediaItemWithDetails),
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

            <div className="space-y-2">
              <Label htmlFor={`genre-${item.id}`}>Genre</Label>
              <Input
                id={`genre-${item.id}`}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="optional"
              />
            </div>
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`duration-${item.id}`}>Duration (min)</Label>
                <Input id={`duration-${item.id}`} type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} min="1" placeholder="optional" />
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

          {error && <FormBanner message={error} variant="error" />}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Saving...
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
