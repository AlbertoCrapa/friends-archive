'use client';

// ============================================================================
// The notification dock.
//
// One provider at the root of the app owns every toast, so a notification
// outlives the component that raised it — a row that has just been deleted,
// a dialog that has just closed — and survives a navigation, which is exactly
// when a deferred action still needs its undo window.
//
// UNDO IS THE DEFAULT SHAPE OF A DESTRUCTIVE ACTION HERE.
//
// Nothing is deleted and then put back. The caller removes the thing from the
// screen straight away and hands the actual write to `commit`, which this
// provider holds until the toast's fuse burns down. Press Undo and the write
// never happens: there is nothing to restore on the server because nothing
// ever left it. That is what keeps the whole dynamic in the front end, and it
// is why undo is instant and cannot half-fail.
//
// The fuse is the clock. Pointing at the toast pauses the CSS animation, which
// pauses the commit with it, so reading a notification never costs you the
// window to reverse it.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SwipeToast, type ToastPayload, type ToastTone } from '@/components/micro/SwipeToast';

/** How long a toast with nothing to undo stays up. */
const DEFAULT_MS = 4200;
/** An undoable one is a deadline, not an announcement — it gets longer. */
const UNDOABLE_MS = 6500;
/**
 * Toasts queue rather than replace each other, so a notification is never lost
 * behind the next one. Past this many, the oldest are settled at once — their
 * commits still run, they just stop waiting for a slot.
 */
const MAX_QUEUE = 3;

export interface ToastRequest {
  message: ReactNode;
  tone?: ToastTone;
  /** Defaults to 'Undo' when `onUndo` is given. */
  actionLabel?: string;
  /** Reverses the optimistic change the caller already made on screen. */
  onUndo?: () => void;
  /**
   * The real write, deferred. Runs once, when the toast leaves WITHOUT having
   * been undone — or immediately if the page is closing.
   */
  commit?: () => void | Promise<void>;
  durationMs?: number;
}

interface ToastApi {
  /** Raises a toast and returns its id. */
  toast: (request: ToastRequest) => string;
  /** Settles a toast early, exactly as if its fuse had burned down. */
  dismiss: (id: string) => void;
}

type QueuedToast = ToastRequest & { id: string };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const counter = useRef(0);
  /** id -> deferred write, for every toast that has not settled yet. */
  const pending = useRef(new Map<string, () => void | Promise<void>>());
  /** Ids whose undo was pressed: their write is dropped instead of run. */
  const undone = useRef(new Set<string>());

  const runCommit = useCallback((id: string) => {
    const commit = pending.current.get(id);
    pending.current.delete(id);
    const cancelled = undone.current.delete(id);
    if (cancelled || !commit) return;
    try {
      void commit();
    } catch {
      // A failed write must never take the app down with it — the caller owns
      // its own error reporting.
    }
  }, []);

  const settle = useCallback(
    (id: string) => {
      setQueue((current) => current.filter((entry) => entry.id !== id));
      runCommit(id);
    },
    [runCommit],
  );

  const toast = useCallback((request: ToastRequest) => {
    counter.current += 1;
    const id = `toast-${Date.now()}-${counter.current}`;
    if (request.commit) pending.current.set(id, request.commit);
    setQueue((current) => [...current, { ...request, id }]);
    return id;
  }, []);

  // Anything pushed out of the queue settles now rather than never: it loses
  // its slot on screen, not its write.
  useEffect(() => {
    if (queue.length <= MAX_QUEUE) return;
    const overflow = queue.slice(0, queue.length - MAX_QUEUE).map((entry) => entry.id);
    setQueue((current) => current.filter((entry) => !overflow.includes(entry.id)));
    overflow.forEach((id) => runCommit(id));
  }, [queue, runCommit]);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss: settle }), [toast, settle]);

  // Leaving the page is the one moment a deferred write cannot keep waiting.
  // Both paths are best-effort by nature: a request started here may not
  // outlive the document, which is the price of the undo window and the reason
  // it is measured in seconds.
  useEffect(() => {
    const flush = () => {
      const commits = [...pending.current.keys()];
      commits.forEach((id) => runCommit(id));
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [runCommit]);

  const visible = queue[0] ?? null;
  const payload: ToastPayload | null = visible
    ? {
        id: visible.id,
        message: visible.message,
        tone: visible.tone ?? 'neutral',
        durationMs: visible.durationMs ?? (visible.onUndo ? UNDOABLE_MS : DEFAULT_MS),
        actionLabel: visible.onUndo ? visible.actionLabel ?? 'Undo' : visible.actionLabel,
        onAction: visible.onUndo
          ? () => {
              // Marked before the toast dismisses itself: the dismissal that
              // follows must drop the write instead of running it.
              undone.current.add(visible.id);
              visible.onUndo?.();
            }
          : undefined,
      }
    : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <SwipeToast toast={payload} onDismiss={() => visible && settle(visible.id)} />
    </ToastContext.Provider>
  );
}
