'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const STAR =
  'M12 1.9 L14.94 8.86 L22.5 9.5 L16.76 14.47 L18.48 21.85 L12 17.92 L5.52 21.85 L7.24 14.47 L1.5 9.5 L9.06 8.86 Z';

export const RATING_WORDS = ['Not for me', 'It was fine', 'Good night in', 'Worth the evening', 'Top shelf'];

interface Props {
  value: number;
  onChange?: (value: number) => void;
  /** Fires on every previewed value while sweeping, and null when the row is left. */
  onPreview?: (value: number | null) => void;
  labels?: string[];
  count?: number;
  size?: number;
  tone?: 'you' | 'group';
  readOnly?: boolean;
  allowClear?: boolean;
  ariaLabel?: string;
}

/**
 * A rating you can try on before you commit to it.
 *
 * Sweeping the row lifts the stars up to the pointer in a trailing wave and
 * hops a word along with it, but nothing is recorded until you release: the
 * preview and the commitment are deliberately different states, because a
 * rating is an opinion on record and a mis-click should not become one.
 * Clicking the current value again clears it.
 */
export function PeekRating({
  value,
  onChange,
  onPreview,
  labels = RATING_WORDS,
  count = 5,
  size = 28,
  tone = 'you',
  readOnly = false,
  allowClear = true,
  ariaLabel = 'Your rating',
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [tipIndex, setTipIndex] = useState(Math.max(0, value - 1));
  const [slot, setSlot] = useState(size + 4);
  const rowRef = useRef<HTMLDivElement>(null);
  const glyphRefs = useRef<(SVGSVGElement | null)[]>([]);
  const pressing = useRef(false);
  const still = useReducedMotion();

  const interactive = !readOnly;
  const previewing = hover !== null;
  const shown = previewing ? hover + 1 : value;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setSlot(row.clientWidth / count);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [count]);

  const preview = useCallback(
    (index: number | null) => {
      setHover((prev) => {
        if (prev === index) return prev;
        onPreview?.(index === null ? null : index + 1);
        return index;
      });
      if (index !== null) setTipIndex(index);
    },
    [onPreview],
  );

  const indexAt = (clientX: number) => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    const raw = Math.floor(((clientX - rect.left) / rect.width) * count);
    return Math.max(0, Math.min(count - 1, raw));
  };

  const pop = (index: number) => {
    const glyph = glyphRefs.current[index];
    if (!glyph || still || typeof glyph.animate !== 'function') return;
    glyph.getAnimations().forEach((a) => a.cancel());
    glyph.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.32)', offset: 0.35 }, { transform: 'scale(1)' }],
      { duration: 340, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  };

  const commit = (next: number) => {
    if (!interactive) return;
    const settled = allowClear && next === value ? 0 : next;
    onChange?.(settled);
    preview(null);
    if (settled > 0) pop(settled - 1);
  };

  useEffect(() => {
    if (!previewing) return;
    const stop = () => {
      pressing.current = false;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [previewing]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!interactive) return;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (step) {
      event.preventDefault();
      const next = Math.max(0, Math.min(count, value + step));
      onChange?.(next);
      if (next > 0) pop(next - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onChange?.(1);
    }
    if (event.key === 'End') {
      event.preventDefault();
      onChange?.(count);
    }
  };

  return (
    <div className="mi mi-rating" data-tone={tone} data-readonly={readOnly}>
      <div
        ref={rowRef}
        className="mi-rating-row"
        role="radiogroup"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (!interactive) return;
          pressing.current = true;
          rowRef.current?.setPointerCapture(e.pointerId);
          preview(indexAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (!interactive) return;
          if (e.pointerType !== 'touch' || pressing.current) preview(indexAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (!interactive) return;
          const index = indexAt(e.clientX);
          rowRef.current?.releasePointerCapture?.(e.pointerId);
          pressing.current = false;
          if (index !== null) commit(index + 1);
        }}
        onPointerLeave={() => {
          if (!pressing.current) preview(null);
        }}
      >
        <span
          className="mi-rating-tip"
          aria-hidden="true"
          data-show={previewing}
          style={{ transform: `translateX(calc(${slot * (tipIndex + 0.5)}px - 50%))` }}
        >
          {labels[tipIndex] ?? String(tipIndex + 1)}
        </span>

        {Array.from({ length: count }, (_, i) => {
          const lifted = previewing && !still && i <= (hover ?? -1);
          const delay = lifted ? Math.max(0, (hover ?? 0) - i) * 22 : i * 10;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i + 1}
              aria-label={`${i + 1} of ${count}. ${labels[i] ?? ''}`}
              tabIndex={i === Math.max(0, value - 1) ? 0 : -1}
              disabled={readOnly}
              className="mi-rating-slot"
              onFocus={() => setTipIndex(i)}
            >
              <span
                className="mi-rating-lift"
                style={{
                  transform: lifted ? `translateY(-6px) scale(${i === hover ? 1.16 : 1})` : 'translateY(0) scale(1)',
                  transitionDelay: `${delay}ms`,
                }}
              >
                <svg
                  ref={(el) => {
                    glyphRefs.current[i] = el;
                  }}
                  className="mi-rating-glyph"
                  data-lit={i < shown}
                  width={size}
                  height={size}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d={STAR} />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
