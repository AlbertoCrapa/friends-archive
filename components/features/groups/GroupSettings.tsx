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
import { Trash2, UserMinus } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  owner_id: string;
}

export interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: { nickname: string } | null;
}

interface Props {
  group: Group;
  members: Member[];
  currentUserId: string;
}

export function GroupSettings({ group, members, currentUserId }: Props) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(group.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('groups')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
      })
      .eq('id', group.id);

    if (updateError) {
      setError('We could not save your changes. Please try again.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  }

  async function removeMember(userId: string) {
    if (userId === currentUserId) return;
    setRemovingMember(userId);
    const supabase = createClient();
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('user_id', userId);
    router.refresh();
    setRemovingMember(null);
  }

  async function deleteGroup() {
    if (!confirm(`Delete "${group.name}"? This is permanent and cannot be undone.`)) return;
    setDeletingGroup(true);
    const supabase = createClient();
    await supabase.from('groups').delete().eq('id', group.id);
    router.push('/dashboard');
  }

  return (
    <div className="space-y-10">
      {/* Info form */}
      <section className="space-y-5">
        <h2 className="font-mono uppercase tracking-widest text-xs text-stone-500">Group info</h2>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <FormBanner message={error} variant="error" />}

          <Button type="submit" disabled={saving}>
            {saved ? (
              'Saved!'
            ) : saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Saving...
              </span>
            ) : (
              'Save changes'
            )}
          </Button>
        </form>
      </section>

      {/* Members */}
      <section className="space-y-4">
        <h2 className="font-mono uppercase tracking-widest text-xs text-stone-500">Members</h2>
        <div className="border border-stone-800/50 divide-y divide-stone-800/50">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-stone-200 text-sm font-mono">
                  {m.profiles?.nickname ?? 'Unknown'}
                </span>
                <span className="text-stone-600 text-xs ml-2 uppercase tracking-wider">
                  {m.role}
                </span>
              </div>
              {m.user_id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-stone-500 hover:text-red-400"
                  disabled={removingMember === m.user_id}
                  onClick={() => removeMember(m.user_id)}
                  title="Remove member"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-4 border border-red-900/50 p-5">
        <h2 className="font-mono uppercase tracking-widest text-xs text-red-500">Danger zone</h2>
        <p className="text-stone-500 text-sm font-light">
          Deleting this group will permanently remove all media items and consumption records.
          This cannot be undone.
        </p>
        <Button
          variant="destructive"
          disabled={deletingGroup}
          onClick={deleteGroup}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {deletingGroup ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Deleting...
            </span>
          ) : (
            'Delete group'
          )}
        </Button>
      </section>
    </div>
  );
}
