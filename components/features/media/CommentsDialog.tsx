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
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { COMMENT_MAX_LENGTH } from '@/types';

// Comments longer than this are clamped with a "Show more" toggle so one very
// long (up to 2000-char) comment can't dominate the thread.
const CLAMP_THRESHOLD = 280;

/** A comment row as fetched for the thread (author name joined from profiles). */
interface CommentRow {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { nickname: string } | null;
}

interface Props {
  itemId: string;
  itemTitle: string;
  /** Current user — required to post/edit/delete their own comment. */
  userId?: string;
  currentUserNickname?: string | null;
  /** Only members may write. Non-members (public groups) read only. */
  isMember?: boolean;
  /** Group owner — may delete anyone's comment (moderation). */
  isOwner?: boolean;
}

// Per-item cache so re-opening a thread doesn't re-fetch.
const commentsCache = new Map<string, CommentRow[]>();

export function CommentsDialog({
  itemId,
  itemTitle,
  userId,
  currentUserNickname,
  isMember = false,
  isOwner = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadComments() {
    const cached = commentsCache.get(itemId);
    if (cached) {
      setComments(cached);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('comments')
      .select('id, author_id, body, created_at, profiles(nickname)')
      .eq('media_item_id', itemId)
      .order('created_at', { ascending: true });

    const next = (data ?? []) as unknown as CommentRow[];
    commentsCache.set(itemId, next);
    setComments(next);
    setLoading(false);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    setError(null);
    setEditingId(null);
    if (isOpen) loadComments();
  }

  function commit(next: CommentRow[]) {
    commentsCache.set(itemId, next);
    setComments(next);
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

    const newRow: CommentRow = {
      id: data.id,
      author_id: data.author_id,
      body: data.body,
      created_at: data.created_at,
      profiles: currentUserNickname ? { nickname: currentUserNickname } : null,
    };
    commit([...(comments ?? []), newRow]);
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

  async function deleteComment(commentId: string) {
    setDeletingId(commentId);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      setError('Could not delete that comment right now. Please try again.');
      setDeletingId(null);
      return;
    }

    commit((comments ?? []).filter((c) => c.id !== commentId));
    setDeletingId(null);
  }

  const count = comments?.length ?? 0;
  const overLimit = draft.length > COMMENT_MAX_LENGTH;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" title="Comments">
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{itemTitle} — Comments</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-stone-500 text-sm font-mono py-6 text-center inline-flex items-center gap-2 justify-center w-full">
            <Spinner />
            Loading...
          </p>
        ) : (
          <div className="space-y-4">
            {/* Comment thread — oldest first */}
            {count > 0 && (
              <p className="text-stone-500 text-[11px] font-mono uppercase tracking-wider">
                {count} comment{count !== 1 ? 's' : ''}
              </p>
            )}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 overscroll-contain">
              {count === 0 ? (
                <p className="text-stone-600 text-sm font-mono py-2 text-center">
                  No comments yet.
                </p>
              ) : (
                (comments ?? []).map((c) => {
                  const isMine = !!userId && c.author_id === userId;
                  const canDelete = isMine || isOwner;
                  const isEditing = editingId === c.id;

                  return (
                    <div key={c.id} className="border border-stone-800 p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-300 text-sm font-mono truncate">
                          {isMine
                            ? currentUserNickname ?? c.profiles?.nickname ?? 'You'
                            : c.profiles?.nickname ?? 'Unknown'}
                        </span>
                        <span className="text-stone-600 text-xs font-mono shrink-0">
                          {formatDate(c.created_at)}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            maxLength={COMMENT_MAX_LENGTH}
                            rows={3}
                            className="text-sm"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                              disabled={savingEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveEdit(c.id)}
                              disabled={savingEdit || !editDraft.trim()}
                            >
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
                              'text-stone-400 text-sm font-light leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
                              c.body.length > CLAMP_THRESHOLD &&
                                !expanded.has(c.id) &&
                                'line-clamp-6'
                            )}
                          >
                            {c.body}
                          </p>
                          {c.body.length > CLAMP_THRESHOLD && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(c.id)}
                              className="text-amber-500/70 hover:text-amber-400 text-[11px] font-mono cursor-pointer"
                            >
                              {expanded.has(c.id) ? 'Show less' : 'Show more'}
                            </button>
                          )}
                          {(isMine || canDelete) && (
                            <div className="flex items-center justify-end gap-1 pt-0.5">
                              {isMine && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-stone-500 hover:text-stone-300"
                                  title="Edit"
                                  onClick={() => startEdit(c)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-stone-500 hover:text-red-400"
                                  title="Delete"
                                  disabled={deletingId === c.id}
                                  onClick={() => deleteComment(c.id)}
                                >
                                  {deletingId === c.id ? (
                                    <Spinner className="h-3 w-3" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* New comment composer — members only */}
            {isMember && userId && (
              <div className="space-y-2 border-t border-stone-800 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                    Add a comment
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      overLimit ? 'text-red-400' : 'text-stone-600'
                    }`}
                  >
                    {draft.length}/{COMMENT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={COMMENT_MAX_LENGTH}
                  rows={3}
                  placeholder="Share what you thought…"
                  className="text-sm"
                />
                {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={postComment}
                    disabled={posting || !draft.trim() || overLimit}
                  >
                    {posting ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner />
                        Posting…
                      </span>
                    ) : (
                      'Post comment'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {!isMember && error && (
              <p className="text-red-400 text-xs font-mono">{error}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
