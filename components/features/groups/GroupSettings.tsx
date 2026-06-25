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
import { Check, Trash2, UserMinus, X } from 'lucide-react';
import { GroupArchiveData } from '@/components/features/groups/GroupArchiveData';

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

export interface JoinRequestRow {
  id: string;
  user_id: string;
  created_at: string;
  profiles: { nickname: string } | null;
}

interface Props {
  group: Group;
  members: Member[];
  joinRequests: JoinRequestRow[];
  currentUserId: string;
}

export function GroupSettings({ group, members, joinRequests, currentUserId }: Props) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(group.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resolvingRequest, setResolvingRequest] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

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

  async function resolveRequest(requestId: string, action: 'approve' | 'decline') {
    setResolvingRequest(requestId);
    setRequestError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      action === 'approve' ? 'approve_join_request' : 'decline_join_request',
      { p_request_id: requestId }
    );
    if (rpcError) {
      setRequestError(
        rpcError.message.includes('plan_limit_reached')
          ? 'This user has reached the group limit of their plan.'
          : 'We could not resolve the request. Please try again.'
      );
    } else {
      router.refresh();
    }
    setResolvingRequest(null);
  }

  async function deleteGroup() {
    setDeletingGroup(true);
    const supabase = createClient();
    await supabase.from('groups').delete().eq('id', group.id);
    router.push('/dashboard');
  }

  return (
    <div className="space-y-10">
      {/* Info form */}
      <section className="space-y-5">
        <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>Group info</h2>
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

      {/* Pending access requests */}
      {joinRequests.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>
            Access requests
          </h2>
          <div className="border border-stone-800/50">
            {joinRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800/30 last:border-b-0"
              >
                <span className="text-stone-200 text-sm font-mono truncate">
                  {request.profiles?.nickname ?? 'Unknown'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {resolvingRequest === request.id ? (
                    <Spinner className="h-3.5 w-3.5 mx-2" />
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-stone-600 hover:text-emerald-400"
                        disabled={resolvingRequest !== null}
                        onClick={() => resolveRequest(request.id, 'approve')}
                        aria-label={`Approve ${request.profiles?.nickname ?? 'request'}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-stone-600 hover:text-red-400"
                        disabled={resolvingRequest !== null}
                        onClick={() => resolveRequest(request.id, 'decline')}
                        aria-label={`Decline ${request.profiles?.nickname ?? 'request'}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {requestError && <FormBanner message={requestError} variant="error" />}
        </section>
      )}

      {/* Members */}
      <section className="space-y-4">
        <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>Members</h2>
        <div className="border border-stone-800/50">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800/30 last:border-b-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-stone-200 text-sm font-mono truncate">
                  {m.profiles?.nickname ?? 'Unknown'}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-wider shrink-0"
                  style={{ color: m.role === 'owner' ? 'var(--color-accent)' : 'oklch(0.4 0.005 60)' }}
                >
                  {m.role}
                </span>
              </div>
              {m.user_id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-stone-600 hover:text-red-400"
                  disabled={removingMember === m.user_id}
                  onClick={() => removeMember(m.user_id)}
                  aria-label={`Remove ${m.profiles?.nickname ?? 'member'}`}
                >
                  {removingMember === m.user_id ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Archive data */}
      <section className="space-y-4">
        <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.42 0.005 60)' }}>Archive data</h2>
        <GroupArchiveData group={group} userId={currentUserId} />
      </section>

      {/* Danger zone */}
      <section className="space-y-5">
        <div className="border-t border-stone-800/50 pt-5">
          <h2 className="font-mono uppercase tracking-[0.3em] text-xs" style={{ color: 'oklch(0.6 0.18 15)' }}>
            Danger zone
          </h2>
        </div>
        <div
          className="border p-5 space-y-4"
          style={{ borderColor: 'oklch(0.5 0.18 15 / 0.3)', backgroundColor: 'oklch(0.12 0.04 15 / 0.15)' }}
        >
          <div className="space-y-1.5">
            <p className="text-stone-200 text-sm font-light">
              Delete <span className="font-mono text-stone-100">{group.name}</span>
            </p>
            <p className="text-stone-500 text-sm font-light">
              Permanently removes all media items and consumption records. This cannot be undone.
            </p>
          </div>

          {!confirmDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-red-900/50 text-red-400 hover:bg-red-950/30 hover:border-red-800/60 hover:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete group
            </Button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-mono" style={{ color: 'oklch(0.72 0.18 15)' }}>
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingGroup}
                  onClick={deleteGroup}
                  className="gap-2"
                >
                  {deletingGroup ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-3 w-3" />
                      Deleting...
                    </span>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Yes, delete
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletingGroup}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
