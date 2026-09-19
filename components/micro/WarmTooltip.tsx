'use client';

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom';

interface Payload {
  id: string;
  x: number;
  y: number;
  side: Side;
  content: ReactNode;
  shortcut?: ReactNode;
}

interface Api {
  show: (payload: Payload) => void;
  hide: (id: string) => void;
  isWarm: () => boolean;
  delay: number;
}

const Ctx = createContext<Api | null>(null);

/**
 * One label, shared by everything inside it.
 *
 * The first tooltip in a group waits out the delay so pointing at a row of
 * marks does not fire six labels. Once one has opened the group stays warm,
 * and the panel glides to the next trigger instead of closing and popping
 * again. Leave the group for longer than the warm window and the delay is
 * back, because by then you are reading something else.
 */
export function WarmTooltipGroup({
  children,
  delay = 420,
  warmWindow = 900,
}: {
  children: ReactNode;
  delay?: number;
  warmWindow?: number;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [mode, setMode] = useState<'pop' | 'glide'>('pop');
  const [mounted, setMounted] = useState(false);
  const warmUntil = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMounted(true);
    return () => clearTimeout(hideTimer.current);
  }, []);

  const api = useMemo<Api>(
    () => ({
      delay,
      isWarm: () => Date.now() < warmUntil.current,
      show: (next) => {
        clearTimeout(hideTimer.current);
        setPayload((prev) => {
          setMode(prev ? 'glide' : 'pop');
          return next;
        });
      },
      hide: (id) => {
        warmUntil.current = Date.now() + warmWindow;
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          setPayload((prev) => (prev && prev.id !== id ? prev : null));
        }, 70);
      },
    }),
    [delay, warmWindow],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted && payload
        ? createPortal(
            <div
              className="mi mi-tip-layer"
              data-mode={mode}
              data-side={payload.side}
              style={{
                transform: `translate3d(${payload.x}px, ${payload.y}px, 0) translate(-50%, ${
                  payload.side === 'top' ? '-100%' : '0'
                })`,
              }}
            >
              <div className="mi-tip-panel" role="tooltip">
                <span>{payload.content}</span>
                {payload.shortcut ? <kbd className="mi-tip-key">{payload.shortcut}</kbd> : null}
                <span className="mi-tip-arrow" aria-hidden="true" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}

let seq = 0;

interface TipProps {
  content: ReactNode;
  shortcut?: ReactNode;
  side?: Side;
  gap?: number;
  children: ReactElement<Record<string, unknown>>;
}

/** Wraps any focusable element. Keyboard focus opens the label without delay. */
export function WarmTooltip({ content, shortcut, side = 'top', gap = 8, children }: TipProps) {
  const api = useContext(Ctx);
  const id = useMemo(() => `tip-${(seq += 1)}`, []);
  const ref = useRef<HTMLElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(openTimer.current), []);

  const place = useCallback((): Payload | null => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = Math.max(12, Math.min(window.innerWidth - 12, r.left + r.width / 2));
    const y = side === 'top' ? r.top - gap : r.bottom + gap;
    return { id, x, y, side, content, shortcut };
  }, [content, gap, id, shortcut, side]);

  const open = useCallback(
    (instant: boolean) => {
      if (!api) return;
      const run = () => {
        const next = place();
        if (next) api.show(next);
      };
      clearTimeout(openTimer.current);
      if (instant || api.isWarm()) run();
      else openTimer.current = setTimeout(run, api.delay);
    },
    [api, place],
  );

  const close = useCallback(() => {
    clearTimeout(openTimer.current);
    api?.hide(id);
  }, [api, id]);

  if (!api) return children;

  return cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      ref.current = node;
      const given = (children as unknown as { ref?: unknown }).ref;
      if (typeof given === 'function') given(node);
      else if (given && typeof given === 'object') (given as { current: unknown }).current = node;
    },
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') open(false);
      (children.props.onPointerEnter as ((e: React.PointerEvent) => void) | undefined)?.(e);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      close();
      (children.props.onPointerLeave as ((e: React.PointerEvent) => void) | undefined)?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      open(true);
      (children.props.onFocus as ((e: React.FocusEvent) => void) | undefined)?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      close();
      (children.props.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(e);
    },
  });
}
