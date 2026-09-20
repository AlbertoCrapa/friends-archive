'use client';

// ============================================================================
// CommentThread — the conversation on one item, wherever it is shown.
//
// This is the whole of the comments feature: loading, the per-item cache, the
// composer, editing, and the undoable delete. It lives on its own because it
// now has two homes — the dialog that has always hung off a row, and the item
// sheet, where the thread sits in the page next to what the group is talking
// ABOUT, which is where a conversation belongs.
//
// Both homes share one cache (module scope), so a thread read in the dialog is
// already there when the sheet opens, and a comment posted in one appears in
// the other.
// ============================================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn, formatRelativeDate } from '@/lib/utils';
import { COMMENT_MAX_LENGTH } from '@/types';

/** Comments longer than this are clamped behind a "Show more" toggle. */
const CLAMP_THRESHOLD = 280;

/** A comment row as fetched for the thread (author name joined from profiles). */
export interface CommentRow {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { nickname: string } | null;
}

/** Per-item cache so re-opening a thread doesn't re-fetch. */
const commentsCache = new Map<string, CommentRow[]>();

/** What the trigger on a row needs to know without opening anything. */
export function cachedCommentCount(itemId: string): number | null {
  return commentsCache.get(itemId)?.length ?? null;
}

interface Props {
  itemId: string;
  /** Current user — required to post/edit/delete their own comment. */
  userId?: string;
  currentUserNickname?: string | null;
  /** Only members may write. Non-members (public groups) read only. */
  isMember?: boolean;
  /** Group owner — may delete anyone's comment (moderation). */
  isOwner?: boolean;
  /** False keeps the thread inert: nothing is fetched until it is on screen. */
  active: boolean;
  /** Give the list its own scrollport (the dialog) or let the page scroll (the sheet). */
  scroll?: boolean;
  onCount?: (count: number) => void;
}

export function CommentThread({
  itemId,
  userId,
  currentUserNickname,
  isMember = false,
  isOwner = false,
  active,
  scroll = true,
  onCount,
}: Props) {
  const [comments, setComments] = useState<CommentRow[] | null>(() => commentsCache.get(itemId) ?? null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (!active) return;
    const cached = commentsCache.get(itemId);
    if (cached) {
      setComments(cached);
      return;
    }
    let alive = true;
    setLoading(true);
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('comments')
        .select('id, author_id, body, created_at, profiles(nickname)')
        .eq('media_item_id', itemId)
        .order('created_at', { ascending: true });
      const next = (data ?? []) as unknown as CommentRow[];
      commentsCache.set(itemId, next);
      if (!alive) return;
      setComments(next);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [active, itemId]);

  useEffect(() => {
    if (comments) onCount?.(comments.length);
  }, [comments, onCount]);

  function commit(next: CommentRow[]) {
    commentsCache.set(itemId, next);
    setComments(next);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function postComment() {
    if (!userId) return;
    const body = draft.trim();
    if (!body) return;

    setPosting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('comments')
      .insert({ media_item_id: itemId, author_id: userId, body })
      .select('id, author_id, body, created_at')
      .single();

    if (insertError || !data) {
      setError('Could not post your comment right now. Please try again.');
      setPosting(false);
      return;
    }

    commit([
      ...(comments ?? []),
      {
        id: data.id,
        author_id: data.author_id,
        body: data.body,
        created_at: data.created_at,
        profiles: currentUserNickname ? { nickname: currentUserNickname } : null,
      },
    ]);
    setDraft('');
    setPosting(false);
  }

  function startEdit(comment: CommentRow) {
    setEditingId(comment.id);
    setEditDraft(comment.body);
    setError(null);
  }

  async function saveEdit(commentId: string) {
    const body = editDraft.trim();
    if (!body) return;

    setSavingEdit(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('comments')
      .update({ body })
      .eq('id', commentId);

    if (updateError) {
      setError('Could not save your edit right now. Please try again.');
      setSavingEdit(false);
      return;
    }

    commit((comments ?? []).map((c) => (c.id === commentId ? { ...c, body } : c)));
    setEditingId(null);
    setSavingEdit(false);
  }

  /**
   * Same bargain as deleting a title: the comment leaves the thread now, the
   * DELETE waits for the toast. The row is put back at the index it was taken
   * from, so an undone deletion leaves the thread in the order it was written.
   */
  function deleteComment(comment: CommentRow) {
    setError(null);
    const list = comments ?? [];
    const index = list.findIndex((c) => c.id === comment.id);
    commit(list.filter((c) => c.id !== comment.id));

    const putBack = () => {
      const current = commentsCache.get(itemId) ?? [];
      if (current.some((c) => c.id === comment.id)) return;
      const next = [...current];
      next.splice(Math.min(index < 0 ? current.length : index, current.length), 0, comment);
      commit(next);
    };

    toast({
      tone: 'destructive',
      message: 'Comment deleted',
      onUndo: putBack,
      commit: async () => {
        const supabase = createClient();
        const { error: deleteError } = await supabase.from('comments').delete().eq('id', comment.id);
        if (!deleteError) return;
        putBack();
        toast({ message: 'Could not delete that comment — it is back in the thread.' });
      },
    });
  }

  const count = comments?.length ?? 0;
  const overLimit = draft.length > COMMENT_MAX_LENGTH;

  if (loading && count === 0) {
    return (
      <p className="inline-flex w-full items-center justify-center gap-2 py-6 text-center text-sm text-stone-500">
        <Spinner />
        Loading…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'space-y-2.5',
          scroll && 'max-h-[50vh] overflow-y-auto overscroll-contain pr-1',
        )}
      >
        {count === 0 ? (
          <p className="py-3 text-center text-[13px] text-stone-600">
            {isMember ? 'No one has said anything yet. Start it.' : 'No comments yet.'}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {(comments ?? []).map((c) => {
              const isMine = !!userId && c.author_id === userId;
              const canDelete = isMine || isOwner;
              const isEditing = editingId === c.id;

              return (
                <motion.div
                  key={c.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className={cn(
                    'group/comment rounded-[var(--radius-md)] border p-2.5',
                    // Your own line is inked differently from everyone else's,
                    // the way a chat marks its own side — one glance tells you
                    // who is speaking without reading a single name.
                    isMine
                      ? 'border-white/[0.09] bg-white/[0.035]'
                      : 'border-white/[0.05] bg-stone-900/40',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-stone-200">
                      {isMine
                        ? currentUserNickname ?? c.profiles?.nickname ?? 'You'
                        : c.profiles?.nickname ?? 'Unknown'}
                    </span>
                    <span className="shrink-0 text-[11px] text-stone-600">
                      {formatRelativeDate(c.created_at)}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        maxLength={COMMENT_MAX_LENGTH}
                        rows={3}
                        className="text-sm"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={savingEdit}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(c.id)} disabled={savingEdit || !editDraft.trim()}>
                          {savingEdit ? (
                            <span className="inline-flex items-center gap-2">
                              <Spinner />
                              Saving…
                            </span>
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p
                        className={cn(
                          'mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-stone-300 [overflow-wrap:anywhere]',
                          c.body.length > CLAMP_THRESHOLD && !expanded.has(c.id) && 'line-clamp-6',
                        )}
                      >
                        {c.body}
                      </p>
                      {c.body.length > CLAMP_THRESHOLD && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(c.id)}
                          className="mt-1 cursor-pointer text-[11.5px] text-amber-500/80 transition-colors hover:text-amber-400"
                        >
                          {expanded.has(c.id) ? 'Show less' : 'Show more'}
                        </button>
                      )}
                      {canDelete && (
                        // Present on touch, quiet on a pointer: the actions
                        // fade up when the comment is hovered or focused, and
                        // are simply there on a device that cannot hover.
                        <div className="mt-1 flex items-center justify-end gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/comment:opacity-100 md:group-focus-within/comment:opacity-100">
                          {isMine && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-stone-500 hover:text-stone-200"
                              title="Edit"
                              onClick={() => startEdit(c)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-stone-500 hover:text-red-400"
                            title="Delete"
                            onClick={() => deleteComment(c)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {isMember && userId ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            rows={2}
            placeholder="Say something to the group…"
            className="text-sm"
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10.5px]', overLimit ? 'text-red-400' : 'text-stone-600')}>
              {draft.length}/{COMMENT_MAX_LENGTH}
            </span>
            <Button size="sm" onClick={postComment} disabled={posting || !draft.trim() || overLimit}>
              {posting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Posting…
                </span>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {!isMember && error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
