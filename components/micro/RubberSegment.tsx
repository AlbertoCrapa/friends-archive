'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';

const EASE = [0.23, 1, 0.32, 1] as const;

export interface SegmentOption {
  value: string;
  label: string;
}

interface Props {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * A segmented control whose thumb is made of rubber: it stretches across the
 * gap it is crossing and squashes onto the slot it lands on, so a change of
 * filter shows where it came from as well as where it went. It can also be
 * grabbed and flicked, which is how the control behaves under a thumb on a
 * phone rather than a cursor on a desk.
 */
export function RubberSegment({ options, value, onChange, ariaLabel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [slots, setSlots] = useState<{ x: number; w: number }[]>([]);
  const [origin, setOrigin] = useState<'left center' | 'right center'>('left center');
  const still = useReducedMotion();

  const x = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const base = slots[0]?.w ?? 0;

  const measure = useCallback(() => {
    const first = btnRefs.current[0];
    if (!first) return;
    const originLeft = first.getBoundingClientRect().left;
    setSlots(
      btnRefs.current.map((el) => {
        const r = el?.getBoundingClientRect();
        return { x: (r?.left ?? originLeft) - originLeft, w: r?.width ?? 0 };
      }),
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, options.length]);

  // Fly to the selected slot. The stretch runs on its own keyframes so the
  // thumb is longest mid-flight and lands slightly over-wide before settling.
  useEffect(() => {
    const slot = slots[index];
    if (!slot || !base) return;
    const target = slot.x;
    const targetScale = slot.w / base;
    const travelled = Math.abs(target - x.get());
    setOrigin(target >= x.get() ? 'left center' : 'right center');

    if (still || travelled < 1) {
      x.set(target);
      scaleX.set(targetScale);
      return;
    }
    const stretch = targetScale * (1 + Math.min(0.34, travelled / 420));
    const controls = [
      animate(x, target, { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }),
      animate(scaleX, [scaleX.get(), stretch, targetScale], {
        duration: 0.38,
        times: [0, 0.42, 1],
        ease: [...EASE],
      }),
    ];
    return () => controls.forEach((c) => c.stop());
  }, [base, index, scaleX, slots, still, x]);

  // One pointer path for tap and drag: under 6px of travel it is a tap on
  // whatever is under the finger, past that the thumb follows the hand and
  // snaps on release using the flick's direction.
  const grip = useRef<{ id: number; startX: number; from: number; moved: boolean } | null>(null);

  const slotAtClientX = (clientX: number) => {
    let best = 0;
    let bestDist = Infinity;
    btnRefs.current.forEach((el, i) => {
      const r = el?.getBoundingClientRect();
      if (!r) return;
      const d = Math.abs(clientX - (r.left + r.width / 2));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  return (
    <div
      ref={rootRef}
      className="mi mi-seg"
      role="radiogroup"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        grip.current = { id: e.pointerId, startX: e.clientX, from: x.get(), moved: false };
        rootRef.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const g = grip.current;
        if (!g || g.id !== e.pointerId) return;
        const dx = e.clientX - g.startX;
        if (!g.moved && Math.abs(dx) < 6) return;
        g.moved = true;
        const last = slots[slots.length - 1];
        const max = last ? last.x : 0;
        const raw = g.from + dx;
        x.set(Math.max(-10, Math.min(max + 10, raw)));
      }}
      onPointerUp={(e) => {
        const g = grip.current;
        grip.current = null;
        rootRef.current?.releasePointerCapture?.(e.pointerId);
        if (!g) return;
        const next = g.moved ? nearestSlot(x.get(), slots) : slotAtClientX(e.clientX);
        const option = options[next];
        if (option && option.value !== value) onChange(option.value);
        else if (option) {
          // Same slot: put the thumb back where it belongs.
          const slot = slots[next];
          if (slot) animate(x, slot.x, { type: 'spring', stiffness: 520, damping: 40 });
        }
      }}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = options[(index + step + options.length) % options.length];
        onChange(next.value);
      }}
    >
      <motion.span
        className="mi-seg-thumb"
        aria-hidden="true"
        style={{ x, scaleX, width: base || undefined, transformOrigin: origin }}
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
          tabIndex={i === index ? 0 : -1}
          className="mi-seg-option"
          data-on={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function nearestSlot(current: number, slots: { x: number; w: number }[]) {
  let best = 0;
  let bestDist = Infinity;
  slots.forEach((slot, i) => {
    const d = Math.abs(slot.x - current);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}
