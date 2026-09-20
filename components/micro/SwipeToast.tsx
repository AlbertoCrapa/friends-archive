'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, Trash2 } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * What the toast is about, which is the only thing that changes its skin: the
 * icon on the left and the colour of the fuse along the bottom. Everything
 * else — surface, radius, shadow, type — is the same on all three, so a
 * notification never reads as a different component depending on what it says.
 */
export type ToastTone = 'neutral' | 'success' | 'destructive';

const TONE_ICON: Record<ToastTone, typeof Check> = {
  neutral: Info,
  success: Check,
  destructive: Trash2,
};

export interface ToastPayload {
  id: string;
  message: ReactNode;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  /** Overrides the dock's default fuse length for this one toast. */
  durationMs?: number;
}

interface Props {
  toast: ToastPayload | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * One toast at a time, rising through its own bottom edge.
 *
 * The fuse along the bottom is the timer itself rather than a picture of one:
 * pointing at the toast pauses the CSS animation, which pauses the dismissal
 * with it, so reading it never costs you the undo. A flick downward throws it
 * away early.
 *
 * The fuse is also the only clock the undo has. Everything the app defers —
 * a delete waiting to be committed — hangs off `onDismiss`, so pausing the
 * animation pauses the deletion too, and the two can never disagree about how
 * long the window was.
 */
export function SwipeToast({ toast, onDismiss, durationMs = 6500 }: Props) {
  const tone = toast?.tone ?? 'neutral';
  const ToneIcon = TONE_ICON[tone];
  const fuseMs = toast?.durationMs ?? durationMs;

  return (
    <div className="mi mi-toast-dock" aria-live="polite">
      <div style={{ overflow: 'hidden', borderRadius: 4 }}>
        <AnimatePresence initial={false}>
          {toast ? (
            <motion.div
              key={toast.id}
              className="mi-toast"
              data-tone={tone}
              initial={{ y: '115%' }}
              animate={{ y: 0 }}
              exit={{ y: '115%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.02, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 36 || info.velocity.y > 420) onDismiss();
              }}
            >
              <span className="mi-toast-icon" aria-hidden>
                <ToneIcon />
              </span>
              <span className="mi-toast-text">{toast.message}</span>
              {toast.actionLabel ? (
                <button
                  type="button"
                  className="mi-toast-undo"
                  onClick={() => {
                    toast.onAction?.();
                    onDismiss();
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
              <span
                className="mi-toast-fuse"
                style={{ '--st-fuse-ms': `${fuseMs}ms` } as CSSProperties}
                onAnimationEnd={onDismiss}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
