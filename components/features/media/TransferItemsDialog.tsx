'use client';

// ============================================================================
// TransferItemsDialog — "send this somewhere else".
//
// One dialog for one title or forty, because the question is the same either
// way and a person who has just picked six films should not be asked it six
// times. Three answers, in the order they are actually decided:
//
//   1. WHERE — every other archive you belong to, with its size, so the two
//      groups you called "Films" are told apart by the thing that differs.
//   2. HOW   — copy (it ends up in both) or move (it leaves this one). That
//      is the ONLY difference: under either verb it arrives as a new entry,
//      added by you, carrying nothing but your own progress.
//   3. WHAT  — what the destination already has is read BEFORE anything is
//      written, so the dialog can say "two of these are already there" instead
//      of the archive quietly growing a second Dune.
//
// The confirm button spells the whole sentence out: "Move 4 to Book Club".
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, FolderInput, Globe, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogSheetBody,
  DialogSheetContent,
  DialogSheetFooter,
  DialogSheetHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import {
  useItemTransfer,
  useTransferTargets,
  type DestinationItem,
  type TransferTarget,
} from '@/hooks/useItemTransfer';
import { planTransfer, type TransferMode } from '@/lib/itemTransfer';
import { cn, countLabel } from '@/lib/utils';
import type { MediaItemWithDetails } from '@/types';
import { ItemPreviewStrip } from './ItemPreviewStrip';

/** Past this many destinations the list needs a way in other than scrolling. */
const SEARCHABLE_FROM = 6;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being sent. One item from a row menu, or a whole selection. */
  items: MediaItemWithDetails[];
  /** The archive they are leaving. */
  groupId: string;
  groupName: string;
  userId: string;
  /** A move takes rows off this screen; the caller owns the undo. */
  onMoved?: (itemIds: string[]) => void;
  onRestored?: (items: MediaItemWithDetails[]) => void;
  /** Fired once the send is away, so the archive can drop its selection. */
  onDone?: () => void;
}

export function TransferItemsDialog({
  open,
  onOpenChange,
  items,
  groupId,
  groupName,
  userId,
  onMoved,
  onRestored,
  onDone,
}: Props) {
  const { toast } = useToast();
  const { targets, state: targetsState } = useTransferTargets({ groupId, userId, enabled: open });
  const { probe, send } = useItemTransfer({ userId, onSent: onMoved, onRestored });

  const [targetId, setTargetId] = useState<string | null>(null);
  const [mode, setMode] = useState<TransferMode>('copy');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What the chosen destination already holds. `null` while it is being read. */
  const [holding, setHolding] = useState<DestinationItem[] | null>(null);

  // Every open is a fresh question. Only the chosen destination is forgotten,
  // never the list itself — that is cached for the session by the hook.
  useEffect(() => {
    if (!open) return;
    setTargetId(null);
    setMode('copy');
    setQuery('');
    setError(null);
    setHolding(null);
    setBusy(false);
  }, [open]);

  // Reading the destination is what makes the preflight line true rather than
  // hopeful, so it happens the moment one is picked — not at confirm time.
  useEffect(() => {
    if (!open || !targetId) return;
    let cancelled = false;
    setHolding(null);
    void probe(targetId).then((rows) => {
      if (!cancelled) setHolding(rows ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, targetId, probe]);

  const target = targets.find((entry) => entry.id === targetId) ?? null;

  const visibleTargets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((entry) => entry.name.toLowerCase().includes(q));
  }, [targets, query]);

  const plan = useMemo(
    () =>
      planTransfer(
        items.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          external_id: item.external_id,
        })),
        holding ?? [],
      ),
    [items, holding],
  );

  const sendingItems = useMemo(() => {
    const ids = new Set(plan.sending.map((entry) => entry.id));
    return items.filter((item) => ids.has(item.id));
  }, [items, plan]);

  const probing = !!targetId && holding === null;
  const nothingToSend = !!target && !probing && sendingItems.length === 0;
  const canSend = !!target && !probing && !busy && sendingItems.length > 0;

  async function confirm() {
    if (!target || sendingItems.length === 0) return;
    setError(null);

    // A move is deferred behind its undo window, so the dialog has nothing to
    // wait for: it gets out of the way and the toast takes over.
    if (mode === 'move') {
      await send({ items: sendingItems, target, mode });
      onOpenChange(false);
      onDone?.();
      return;
    }

    setBusy(true);
    const result = await send({ items: sendingItems, target, mode });
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not send these right now. Please try again.');
      return;
    }

    toast({
      tone: 'success',
      message:
        result.count === 1 ? (
          <>
            Copied <b>{sendingItems[0].title}</b> to <b>{target.name}</b>
          </>
        ) : (
          <>
            Copied {countLabel(result.count)} to <b>{target.name}</b>
          </>
        ),
    });
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogSheetContent open={open} onDismiss={() => onOpenChange(false)}>
        <DialogSheetHeader>
          <DialogTitle>
            {items.length === 1 ? 'Send this item' : `Send ${countLabel(items.length)}`}
          </DialogTitle>
          <p className="mt-1 truncate text-[12.5px] text-stone-500">
            {items.length === 1 ? items[0].title : `from ${groupName}`}
          </p>
        </DialogSheetHeader>

        <DialogSheetBody className="space-y-5">
          {/* What is in your hands. On a multi-item send this is the only place
              the covers are still visible, so it is worth the strip. */}
          {items.length > 1 ? <ItemPreviewStrip items={items} /> : null}

          {/* ── 1. Where ───────────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-stone-500">
              To which archive
            </h3>

            {targetsState === 'loading' ? (
              <div className="flex items-center gap-2 py-4 text-[13px] text-stone-500">
                <Spinner className="h-3.5 w-3.5" />
                Looking up your archives
              </div>
            ) : targetsState === 'error' ? (
              <p className="py-3 text-[13px] text-red-400">
                Could not read your archives. Close this and try again.
              </p>
            ) : targets.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-white/[0.07] bg-stone-900 p-4 text-center">
                <p className="text-[13px] text-stone-300">{groupName} is the only archive you are in.</p>
                <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-stone-500">
                  Start another one, or join a friend&apos;s, and titles can travel between them.
                </p>
                <Link href="/groups/new" className="mt-3 inline-flex">
                  <Button size="sm" variant="secondary">
                    New archive
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {targets.length >= SEARCHABLE_FROM ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find an archive"
                      className="h-9 pl-9 text-[13px]"
                    />
                  </div>
                ) : null}

                <ul role="radiogroup" aria-label="Destination archive" className="space-y-1">
                  {visibleTargets.map((entry) => (
                    <li key={entry.id} role="none">
                      <DestinationRow
                        target={entry}
                        selected={entry.id === targetId}
                        onSelect={() => setTargetId(entry.id)}
                      />
                    </li>
                  ))}
                  {visibleTargets.length === 0 ? (
                    <li role="none" className="px-1 py-3 text-[12.5px] text-stone-500">
                      No archive by that name.
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </section>

          {/* ── 2. How ─────────────────────────────────────────────────── */}
          {targets.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                Copy or move
              </h3>
              <div role="radiogroup" aria-label="Copy or move" className="grid gap-2 sm:grid-cols-2">
                {/* The two cards say ONLY what differs. Everything they have in
                    common is said once, underneath, instead of twice in
                    slightly different words. */}
                <ModeCard
                  active={mode === 'copy'}
                  onSelect={() => setMode('copy')}
                  icon={<Copy className="h-4 w-4" />}
                  title="Copy"
                  detail={`It stays in ${groupName} too, exactly as it is.`}
                />
                <ModeCard
                  active={mode === 'move'}
                  onSelect={() => setMode('move')}
                  icon={<FolderInput className="h-4 w-4" />}
                  title="Move"
                  tone="warn"
                  detail={`It leaves ${groupName} — and its comments, notes and ratings are deleted with it.`}
                />
              </div>

              <p className="text-[11.5px] leading-relaxed text-stone-500">
                Either way it arrives as a <b className="font-medium text-stone-400">new entry added by you</b>.
                Nobody&apos;s comments, notes or ratings travel with it — only your own progress does.
              </p>
            </section>
          ) : null}

          {/* ── 3. What will actually happen ───────────────────────────── */}
          {target ? (
            <Preflight
              probing={probing}
              sending={sendingItems.length}
              duplicates={plan.duplicates.length}
              duplicateTitles={plan.duplicates.map((entry) => entry.title)}
              target={target}
              mode={mode}
            />
          ) : null}

          {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
        </DialogSheetBody>

        <DialogSheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!canSend} className="gap-2">
            {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
            {nothingToSend
              ? 'Nothing to send'
              : target
                ? `${mode === 'move' ? 'Move' : 'Copy'} ${sendingItems.length} to ${target.name}`
                : 'Pick an archive'}
          </Button>
        </DialogSheetFooter>
      </DialogSheetContent>
    </Dialog>
  );
}

function DestinationRow({
  target,
  selected,
  onSelect,
}: {
  target: TransferTarget;
  selected: boolean;
  onSelect: () => void;
}) {
  const VisibilityIcon = target.visibility === 'public' ? Globe : Lock;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-white/[0.07] bg-stone-900 hover:border-white/20',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
          selected ? 'border-amber-400 bg-amber-400 text-stone-950' : 'border-stone-600',
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-stone-100">{target.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-stone-500">
          <VisibilityIcon className="h-2.5 w-2.5" aria-hidden />
          {target.visibility === 'public' ? 'Public' : 'Private'}
          <span aria-hidden className="text-stone-700">
            ·
          </span>
          {countLabel(target.itemCount)}
        </span>
      </span>
    </button>
  );
}

function ModeCard({
  active,
  onSelect,
  icon,
  title,
  detail,
  tone = 'neutral',
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-[var(--radius-md)] border p-3 text-left transition-colors',
        active
          ? tone === 'warn'
            ? 'border-amber-500/60 bg-amber-500/10'
            : 'border-stone-400/50 bg-stone-800/70'
          : 'border-white/[0.07] bg-stone-900 hover:border-white/20',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-2 text-[13.5px] font-semibold',
          active ? 'text-stone-50' : 'text-stone-300',
        )}
      >
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-[11.5px] leading-relaxed text-stone-500">{detail}</span>
    </button>
  );
}

/**
 * The sentence the confirm button is about to carry out, written before it is
 * pressed — including the part nobody expects, which is what gets left behind.
 */
function Preflight({
  probing,
  sending,
  duplicates,
  duplicateTitles,
  target,
  mode,
}: {
  probing: boolean;
  sending: number;
  duplicates: number;
  duplicateTitles: string[];
  target: TransferTarget;
  mode: TransferMode;
}) {
  if (probing) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-stone-500">
        <Spinner className="h-3.5 w-3.5" />
        Checking what {target.name} already has
      </p>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-white/[0.07] bg-stone-900/70 p-3 text-[12.5px] leading-relaxed">
      <p className="flex items-center gap-2 text-stone-300">
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        {sending === 0 ? (
          <span>Everything you picked is already in {target.name}.</span>
        ) : (
          <span>
            {mode === 'move' ? 'Moving' : 'Copying'} <b className="text-stone-100">{countLabel(sending)}</b> to{' '}
            <b className="text-stone-100">{target.name}</b>.
          </span>
        )}
      </p>
      {duplicates > 0 ? (
        <p className="mt-1.5 pl-[22px] text-stone-500">
          {duplicates === 1 ? (
            <>
              <b className="font-medium text-stone-400">{duplicateTitles[0]}</b> is already there — it stays put.
            </>
          ) : (
            <>
              {duplicates} of them are already there and stay put: {duplicateTitles.slice(0, 3).join(', ')}
              {duplicateTitles.length > 3 ? `, and ${duplicateTitles.length - 3} more` : ''}.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
