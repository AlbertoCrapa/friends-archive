'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';

const ACTION_W = 80;
const SLOP = 8;

export interface SwipeAction {
  id: string;
  label: string;
  tone?: 'out' | 'start' | 'neutral';
  icon?: ReactNode;
  /** A full swipe runs the first action. Set false to require a deliberate tap. */
  onSelect: () => void;
}

interface Props {
  children: ReactNode;
  actions: SwipeAction[];
  /** Announced to screen readers as the name of the row's action menu. */
  label: string;
  /** Run when a full swipe commits the first action, after the row has left. */
  onCommit?: (action: SwipeAction) => void;
  disabled?: boolean;
}

/**
 * A row you can pull aside to reach its actions.
 *
 * Short pull: the drawer opens and stays open, so you can read the labels
 * before choosing. Long pull past the halfway mark: the first action's colour
 * floods the row and letting go runs it, which is the gesture worth having on
 * a phone where the whole queue is triage. Everything the gesture can do is
 * also on a button, because a gesture no one discovers is not a feature.
 */
export function SwipeRow({ children, actions, label, onCommit, disabled }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [width, setWidth] = useState(0);
  const still = useReducedMotion();

  const rail = actions.length * ACTION_W;
  const primary = actions[0];
  const commitPoint = Math.max(rail + ACTION_W * 0.6, width * 0.52);
  const grip = useRef<{ id: number; x0: number; y0: number; from: number; axis: 'x' | 'y' | null; samples: [number, number][] } | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const settle = (to: number) => {
    setArmed(false);
    setOpen(to !== 0);
    if (still) {
      x.set(to);
      return;
    }
    animate(x, to, { type: 'spring', stiffness: 560, damping: 44, mass: 0.9 });
  };

  const commit = () => {
    const action = primary;
    if (!action) return settle(0);
    setOpen(false);
    const finish = () => {
      action.onSelect();
      onCommit?.(action);
    };
    if (still) return finish();
    animate(x, -width, { duration: 0.22, ease: [0.4, 0, 1, 1] }).then(finish);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="mi mi-swipe" ref={rootRef}>
      <div className="mi-swipe-rail" aria-hidden={!open}>
        {primary ? <span className="mi-swipe-flood" data-armed={armed} data-tone={primary.tone ?? 'neutral'} /> : null}
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="mi-swipe-action"
            data-tone={action.tone ?? 'neutral'}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              settle(0);
              action.onSelect();
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <motion.div
        className="mi-swipe-surface"
        style={{ x }}
        onPointerDown={(e) => {
          if (disabled) return;
          grip.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: x.get(), axis: null, samples: [[performance.now(), e.clientX]] };
        }}
        onPointerMove={(e) => {
          const g = grip.current;
          if (!g || g.id !== e.pointerId) return;
          const dx = e.clientX - g.x0;
          const dy = e.clientY - g.y0;
          if (g.axis === null) {
            if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
              g.axis = 'y';
              return;
            }
            if (Math.abs(dx) < SLOP) return;
            g.axis = 'x';
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }
          if (g.axis !== 'x') return;
          g.samples.push([performance.now(), e.clientX]);
          if (g.samples.length > 6) g.samples.shift();
          const raw = g.from + dx;
          // Pulling the wrong way is resisted hard; past the drawer it is
          // resisted gently, because that stretch is the commit gesture.
          const next = raw > 0 ? raw * 0.14 : raw < -rail ? -rail + (raw + rail) * 0.72 : raw;
          x.set(next);
          setArmed(-next > commitPoint);
        }}
        onPointerUp={(e) => {
          const g = grip.current;
          grip.current = null;
          if (!g || g.axis !== 'x') return;
          const [t0, p0] = g.samples[0];
          const v = ((e.clientX - p0) / Math.max(1, performance.now() - t0)) * 1000;
          const projected = x.get() + v * 0.09;
          if (-projected > commitPoint && primary) return commit();
          if (v > 420) return settle(0);
          if (v < -420) return settle(-rail);
          settle(-x.get() > rail * 0.5 ? -rail : 0);
        }}
        onPointerCancel={() => {
          grip.current = null;
          settle(0);
        }}
      >
        {children}
        <button
          type="button"
          className="mi-swipe-handle"
          aria-label={label}
          aria-expanded={open}
          onClick={() => settle(open ? 0 : -rail)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="3" cy="7" r="1.3" fill="currentColor" />
            <circle cx="7" cy="7" r="1.3" fill="currentColor" />
            <circle cx="11" cy="7" r="1.3" fill="currentColor" />
          </svg>
        </button>
      </motion.div>
    </div>
  );
}
