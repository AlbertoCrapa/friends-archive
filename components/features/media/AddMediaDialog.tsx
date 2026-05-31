'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus } from 'lucide-react';
import type { MediaType, ItemStatus, MediaItem } from '@/types';
import { getStatusOptions } from '@/types';

interface Props {
  groupId: string;
  userId: string;
  activeType: MediaType | 'all';
  onAdded?: (item: MediaItem) => void;
}

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

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function buildMetadata(): Record<string, unknown> {
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
    const { data: insertedItem, error: insertError } = await supabase
      .from('media_items')
      .insert({
        group_id: groupId,
        added_by: userId,
        title: title.trim(),
        type,
        status,
        metadata: buildMetadata(),
      })
      .select('id, group_id, title, type, status, genre, metadata, added_by, created_at, updated_at')
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

    setTitle('');
    setDirector('');
    setCreator('');
    setAuthor('');
    setDeveloper('');
    setReleaseYear('');
    setSeasons('');
    setDurationMinutes('');
    setPlatform('');
    setStatus('plan_to_consume');
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add an item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeType === 'all' && (
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as MediaType)}>
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
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title…"
              required
            />
          </div>

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
              <div className="space-y-2 col-span-2">
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
              <div className="space-y-2 col-span-2">
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Adding...
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
