'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormBanner } from '@/components/ui/form-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be signed in to create a group.');
      setLoading(false);
      return;
    }

    const { data: group, error: insertError } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        owner_id: user.id,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.message.includes('group_limit')) {
        setError('You have reached your group limit. Upgrade your plan to create more groups.');
      } else {
        setError('We could not create this group right now. Please try again.');
      }
      setLoading(false);
      return;
    }

    router.push(`/groups/${group.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Group name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday Night Movies"
          maxLength={80}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description <span className="text-stone-600">(optional)</span></Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this group for?"
          maxLength={300}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as 'public' | 'private')}>
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Private — only members can see it</SelectItem>
            <SelectItem value="public">Public — anyone can discover and view it</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <FormBanner message={error} variant="error" />}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Creating...
            </span>
          ) : (
            'Create group'
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
