'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';

// The thumb is described by its two edges, never by "position + width". A
// segmented control has slots of different widths (a count turns "TV" into
// "TV 4"), and any model that animates one anchor plus a scale has to pick
// which anchor the scale grows from — pick wrong and the thumb lands offset by
// the width difference. Two edges cannot land wrong: each one is animated to
// the pixel it belongs on.
//
// The rubber is what falls out of that: the edge in front runs a stiff spring,
// the edge behind runs a slack one, so the thumb stretches while it travels and
// squashes back as the trailing edge catches up.
const LEAD = { type: 'spring', stiffness: 640, damping: 42, mass: 0.9 } as const;
const TRAIL = { type: 'spring', stiffness: 260, damping: 24, mass: 0.9 } as const;

/** Fallback for --rs-thumb-radius, read off the element at measure time. */
const FALLBACK_RADIUS = 7;

export interface SegmentOption {
  value: string;
  label: string;
  /** Optional leading glyph. On narrow screens it is what survives. */
  icon?: ReactNode;
  /** Small trailing number, e.g. how many rows the filter would leave. */
  count?: number;
}

interface Props {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /**
   * Below this width, drop the word from any option that has an icon and keep
   * the glyph. 'sm' (under 640px) for a filter whose words are worth keeping as
   * long as they fit; 'lg' (under 1024px) for a control that reads fine as
   * icons and would otherwise push its neighbours off the row.
   */
  tight?: 'sm' | 'lg';
}

/**
 * A segmented control whose thumb is made of rubber: it stretches across the
 * gap it is crossing and squashes onto the slot it lands on, so a change of
 * filter shows where it came from as well as where it went.
 */
export function RubberSegment({ options, value, onChange, ariaLabel, tight }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [slots, setSlots] = useState<{ x: number; w: number }[]>([]);
  const still = useReducedMotion();

  // The two edges, in pixels from the first slot's left edge.
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  // What the DOM actually gets: a translate and a horizontal scale, both cheap.
  const x = useMotionValue(0);
  const scaleX = useMotionValue(1);
  // ...and the corner correction that a horizontal scale makes necessary.
  const radius = useMotionValue(`${FALLBACK_RADIUS}px`);
  const radiusPx = useRef(FALLBACK_RADIUS);

  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const base = slots[0]?.w ?? 0;

  const measure = useCallback(() => {
    const first = btnRefs.current[0];
    const root = rootRef.current;
    if (!first || !root) return;
    // The radius is read from the stylesheet's own custom property, not from
    // the thumb — the thumb's border-radius is overwritten below, so reading it
    // back would feed the correction its own output.
    const declared = parseFloat(getComputedStyle(root).getPropertyValue('--rs-thumb-radius'));
    radiusPx.current = Number.isFinite(declared) ? declared : FALLBACK_RADIUS;

    const originLeft = first.getBoundingClientRect().left;
    setSlots(
      btnRefs.current.map((el) => {
        const rect = el?.getBoundingClientRect();
        return { x: (rect?.left ?? originLeft) - originLeft, w: rect?.width ?? 0 };
      }),
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    // Every slot is observed, not just the container: a count going from 9 to
    // 10 changes one slot's width without changing the control's.
    const ro = new ResizeObserver(measure);
    btnRefs.current.forEach((el) => el && ro.observe(el));
    if (rootRef.current) ro.observe(rootRef.current);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, options.length]);

  // Edges in, transform out.
  //
  // A horizontal scale squashes the corners with everything else: a 7px radius
  // on a thumb stretched to 1.8× renders as a 12.6px ellipse, which is exactly
  // the smeared corner you see on the widest slot. Pre-dividing the HORIZONTAL
  // radius by the scale cancels it, so the corner comes out 7px round however
  // far the thumb is stretched.
  useEffect(() => {
    const sync = () => {
      const a = left.get();
      const b = right.get();
      const scale = base > 0 ? Math.max(0.02, (b - a) / base) : 1;
      x.set(a);
      scaleX.set(scale);
      radius.set(`${(radiusPx.current / scale).toFixed(2)}px / ${radiusPx.current}px`);
    };
    const stop = [left.on('change', sync), right.on('change', sync)];
    sync();
    return () => stop.forEach((off) => off());
  }, [base, left, radius, right, scaleX, x]);

  useEffect(() => {
    const slot = slots[index];
    if (!slot || !slot.w) return;
    const targetLeft = slot.x;
    const targetRight = slot.x + slot.w;
    const settled =
      Math.abs(targetLeft - left.get()) < 1 && Math.abs(targetRight - right.get()) < 1;

    if (still || settled) {
      left.set(targetLeft);
      right.set(targetRight);
      return;
    }
    const goingRight = targetLeft > left.get();
    const controls = [
      animate(left, targetLeft, goingRight ? TRAIL : LEAD),
      animate(right, targetRight, goingRight ? LEAD : TRAIL),
    ];
    return () => controls.forEach((control) => control.stop());
  }, [index, left, right, slots, still]);

  return (
    <div
      ref={rootRef}
      className={`mi mi-seg${tight ? ` mi-seg-tight-${tight}` : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        onChange(options[(index + step + options.length) % options.length].value);
      }}
    >
      <motion.span
        className="mi-seg-thumb"
        aria-hidden="true"
        style={{ x, scaleX, borderRadius: radius, width: base || undefined }}
      />
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          // The word can be hidden by CSS on a narrow screen, which takes it out
          // of the accessibility tree too, so the name is always spelled out here.
          aria-label={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
          tabIndex={i === index ? 0 : -1}
          className="mi-seg-option"
          data-on={option.value === value}
          data-icon={option.icon ? 'true' : 'false'}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.icon}
          <span className="mi-seg-label">{option.label}</span>
          {option.count === undefined ? null : (
            <span className="mi-seg-count" aria-hidden="true">
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
