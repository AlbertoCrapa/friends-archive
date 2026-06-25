'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const NOTE_MAX = 500;

interface ConsumptionRecord {
  user_id: string;
  consumed_at: string;
  note: string | null;
  profiles: { nickname: string } | null;
}

interface Props {
  itemId: string;
  itemTitle: string;
  /** Current user — required to write/edit their own review. */
  userId?: string;
  currentUserNickname?: string | null;
  /** Only members may write. Non-members (public groups) read only. */
  isMember?: boolean;
}

const recordsCache = new Map<string, ConsumptionRecord[]>();

export function ConsumedByDialog({
  itemId,
  itemTitle,
  userId,
  currentUserNickname,
  isMember = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<ConsumptionRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function seedDraft(list: ConsumptionRecord[]) {
    if (!userId) return;
    const mine = list.find((r) => r.user_id === userId);
    setDraft(mine?.note ?? '');
  }

  async function loadRecords() {
    const cached = recordsCache.get(itemId);
    if (cached) {
      setRecords(cached);
      seedDraft(cached);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('consumption_records')
      .select('user_id, consumed_at, note, profiles(nickname)')
      .eq('media_item_id', itemId)
      .order('consumed_at', { ascending: false });

    const next = (data ?? []) as unknown as ConsumptionRecord[];
    recordsCache.set(itemId, next);
    setRecords(next);
    seedDraft(next);
    setLoading(false);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    setError(null);
    if (isOpen) loadRecords();
  }

  async function saveReview() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const note = draft.trim() ? draft.trim() : null;

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from('consumption_records')
      .upsert(
        { user_id: userId, media_item_id: itemId, note },
        { onConflict: 'media_item_id,user_id' }
      );

    if (upsertError) {
      setError('Could not save your review right now. Please try again.');
      setSaving(false);
      return;
    }

    setRecords((prev) => {
      const list = prev ? [...prev] : [];
      const idx = list.findIndex((r) => r.user_id === userId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], note };
      } else {
        list.unshift({
          user_id: userId,
          consumed_at: new Date().toISOString(),
          note,
          profiles: currentUserNickname ? { nickname: currentUserNickname } : null,
        });
      }
      recordsCache.set(itemId, [...list]);
      return [...list];
    });
    setSaving(false);
  }

  const myExistingNote =
    userId && records ? records.find((r) => r.user_id === userId)?.note ?? null : null;
  const dirty = (draft.trim() || null) !== (myExistingNote ?? null);
  const others = (records ?? []).filter((r) => r.user_id !== userId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" title="Reviews & notes">
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{itemTitle} — Reviews</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-stone-500 text-sm font-mono py-6 text-center inline-flex items-center gap-2 justify-center w-full">
            <Spinner />
            Loading...
          </p>
        ) : (
          <div className="space-y-4">
            {/* Your review — write once, edit anytime */}
            {isMember && userId && (
              <div className="space-y-2 border-b border-stone-800 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                    Your review
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      draft.length > NOTE_MAX ? 'text-red-400' : 'text-stone-600'
                    }`}
                  >
                    {draft.length}/{NOTE_MAX}
                  </span>
                </div>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={NOTE_MAX}
                  rows={3}
                  placeholder="Share what you thought…"
                  className="text-sm"
                />
                {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveReview}
                    disabled={saving || !dirty || draft.length > NOTE_MAX}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner />
                        Saving…
                      </span>
                    ) : myExistingNote ? (
                      'Update review'
                    ) : (
                      'Post review'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Everyone else's reviews */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {others.length === 0 ? (
                <p className="text-stone-600 text-sm font-mono py-2 text-center">
                  No other reviews yet.
                </p>
              ) : (
                others.map((r) => (
                  <div key={r.user_id} className="border border-stone-800 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-300 text-sm font-mono">
                        {r.profiles?.nickname ?? 'Unknown'}
                      </span>
                      <span className="text-stone-600 text-xs font-mono">
                        {formatDate(r.consumed_at)}
                      </span>
                    </div>
                    {r.note ? (
                      <p className="text-stone-500 text-xs font-light italic leading-relaxed">
                        &ldquo;{r.note}&rdquo;
                      </p>
                    ) : (
                      <p className="text-stone-700 text-xs font-mono">consumed · no note</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
