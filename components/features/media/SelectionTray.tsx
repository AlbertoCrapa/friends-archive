'use client';

// ============================================================================
// SelectionTray — what you are holding, and what you can do to all of it.
//
// Picking several titles is a gathering job, not a form: you find one under a
// search, one three pages later, one behind the Books filter. So the tray is
// the ONE thing on the page that does not care about any of that — the
// selection lives above the filters (see GroupMediaSection), and this bar says
// what is in your hands.
//
// Three verbs, ordered by how much they cost you if you meant something else.
// Status is reversible with the same control, so it sits first and quietest.
// Send adds somewhere without taking anything away, so it is the primary.
// Delete is the only one that destroys, so it is last, red, icon-only, and the
// only one that stops to ask a question before it does anything.
//
// It is portalled to the body and fixed to the bottom edge for the same reason
// the add button is: inside the archive's own scroll container it would drift
// away exactly when you are still collecting.
// ============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { CircleDot, FolderInput, Trash2, X } from 'lucide-react';
import { GlideSelect } from '@/components/micro/GlideSelect';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { countLabel } from '@/lib/utils';
import { getStatusOptions } from '@/types';
import type { ItemStatus, MediaItemWithDetails } from '@/types';
import { MediaPoster } from './MediaPoster';
import { statusOptions } from './StatusDot';

/** Covers in the stack before it starts counting instead. */
const STACK_LIMIT = 4;

/* The same four rows, with the same dots, that the filter and every row menu
   show — this bar sets a status, so it should not invent a second way to
   pick one. */
const STATUS_OPTIONS = statusOptions(getStatusOptions());

interface Props {
  /** The items currently held — across every filter and page, not just this one. */
  items: MediaItemWithDetails[];
  /** How many rows the current filters leave, for "select all". */
  shownCount: number;
  /** True when every row the filters leave is already held. */
  allShownSelected: boolean;
  onSelectAllShown: () => void;
  onClear: () => void;
  /** Leaves selection mode entirely. */
  onExit: () => void;
  onSend: () => void;
  /** One status across everything held. Reversible from the same menu. */
  onSetStatus: (next: ItemStatus) => void;
  /** Opens the confirmation. This tray never deletes anything by itself. */
  onDelete: () => void;
  /** A batch write is in flight — the actions stand down until it lands. */
  busy?: boolean;
}

export function SelectionTray({
  items,
  shownCount,
  allShownSelected,
  onSelectAllShown,
  onClear,
  onExit,
  onSend,
  onSetStatus,
  onDelete,
  busy = false,
}: Props) {
  const reduced = useReducedMotion();
  // Portals need the document, which the server render does not have.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const stack = items.slice(0, STACK_LIMIT);
  const extra = items.length - stack.length;
  const empty = items.length === 0;
  const locked = empty || busy;

  return createPortal(
    <motion.div
      initial={reduced ? { opacity: 0 } : { y: 120, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 460, damping: 42, mass: 0.9 }}
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      className="fixed inset-x-3 z-50 mx-auto max-w-2xl sm:inset-x-6"
    >
      <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-white/[0.09] bg-stone-900/95 p-2.5 shadow-[var(--shadow-3)] backdrop-blur-sm sm:gap-3 sm:px-3.5">
        {/* The hand of cards. Nothing to hold yet is said with words, so the
            bar keeps its height and never jumps as the first one goes in. */}
        {empty ? (
          <p className="min-w-0 flex-1 px-1 text-[12.5px] text-stone-500">
            Tap the titles you want to send.
          </p>
        ) : (
          <>
            <div className="hidden shrink-0 sm:flex">
              {stack.map((item, index) => (
                <motion.span
                  key={item.id}
                  layout
                  initial={reduced ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-[var(--radius-sm)] ring-2 ring-stone-900"
                  style={{ marginLeft: index === 0 ? 0 : -16, zIndex: stack.length - index }}
                >
                  <MediaPoster src={item.image_url} type={item.type} size="xs" />
                </motion.span>
              ))}
              {extra > 0 ? (
                <span
                  className="ml-1 grid h-10 w-7 place-items-center rounded-[var(--radius-sm)] bg-stone-800 text-[11px] font-semibold text-stone-400"
                  aria-hidden
                >
                  +{extra}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-stone-100" aria-live="polite">
                {countLabel(items.length)} selected
              </p>
              <div className="flex items-center gap-2 text-[11.5px] text-stone-500">
                {!allShownSelected && shownCount > 0 ? (
                  <button
                    type="button"
                    onClick={onSelectAllShown}
                    className="cursor-pointer underline decoration-stone-700 underline-offset-2 transition-colors hover:text-stone-200"
                  >
                    Select all {shownCount} shown
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClear}
                  className="cursor-pointer underline decoration-stone-700 underline-offset-2 transition-colors hover:text-stone-200"
                >
                  Clear
                </button>
              </div>
            </div>
          </>
        )}

        {empty && shownCount > 0 ? (
          <Button variant="secondary" size="sm" onClick={onSelectAllShown} className="shrink-0">
            Select all {shownCount}
          </Button>
        ) : null}

        {empty ? null : (
          <div className="flex shrink-0 items-center gap-1.5">
            {/* No value on the trigger: this one only sets. The heading is
                what keeps it honest — the same four rows on a single row's
                menu change one title, and these change everything held. */}
            <span className={locked ? 'pointer-events-none opacity-60' : undefined}>
              <GlideSelect
                align="right"
                className="mi-select-touch"
                ariaLabel={`Set one status for all ${countLabel(items.length)}`}
                heading={`Mark all ${countLabel(items.length)} as`}
                value=""
                onChange={(next) => onSetStatus(next as ItemStatus)}
                label={
                  <>
                    {busy ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5 opacity-60" />
                    )}
                    Status
                  </>
                }
                options={STATUS_OPTIONS}
              />
            </span>

            <Button size="sm" onClick={onSend} disabled={locked} className="gap-1.5">
              <FolderInput className="h-3.5 w-3.5" />
              Send
            </Button>

            {/* Icon-only and last. It asks before it does anything, so the
                narrow target is a speed bump rather than a hazard. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={locked}
              aria-label={`Delete all ${countLabel(items.length)}`}
              className="h-8 w-8 text-stone-400 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onExit}
          aria-label="Leave selection mode"
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>,
    document.body,
  );
}
