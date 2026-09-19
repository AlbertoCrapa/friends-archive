'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface ToastPayload {
  id: string;
  message: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
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
 */
export function SwipeToast({ toast, onDismiss, durationMs = 6500 }: Props) {
  return (
    <div className="mi mi-toast-dock" aria-live="polite">
      <div style={{ overflow: 'hidden', borderRadius: 4 }}>
        <AnimatePresence initial={false}>
          {toast ? (
            <motion.div
              key={toast.id}
              className="mi-toast"
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
                style={{ animationDuration: `${durationMs}ms` }}
                onAnimationEnd={onDismiss}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
