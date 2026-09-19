'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface GlideOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: GlideOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  align?: 'left' | 'right';
}

/**
 * A select whose menu pops out of the corner it hangs from, and whose single
 * highlight glides between rows rather than blinking from one to the next.
 * When the pointer leaves and comes back the highlight is still where it was,
 * so the menu keeps your place instead of resetting it.
 */
export function GlideSelect({ options, value, onChange, label, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const [box, setBox] = useState<{ y: number; h: number } | null>(null);
  const [jump, setJump] = useState(true);
  const [inside, setInside] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  // Place the highlight on whatever is active. The first placement after
  // opening jumps; everything after it glides.
  useLayoutEffect(() => {
    if (!open) return;
    const el = optionRefs.current[active];
    const menu = menuRef.current;
    if (!el || !menu) return;
    setBox({ y: el.offsetTop - menu.clientTop - 3, h: el.offsetHeight });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setJump(true);
    const id = window.setTimeout(() => setJump(false), 40);
    return () => window.clearTimeout(id);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const choose = (option: GlideOption) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div className="mi mi-select" ref={rootRef}>
      <button
        type="button"
        className="mi-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span style={{ color: 'var(--mi-ink-3)' }}>{label}</span>
        {selected?.label}
        <svg className="mi-select-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="mi-select-menu"
          data-align={align}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onPointerLeave={() => setInside(false)}
          onPointerEnter={() => setInside(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              const next = (active + step + options.length) % options.length;
              setActive(next);
              optionRefs.current[next]?.focus();
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose(options[active]);
            }
          }}
        >
          <span
            className="mi-select-highlight"
            aria-hidden="true"
            data-jump={jump}
            style={{
              height: box?.h ?? 0,
              transform: `translateY(${box?.y ?? 0}px)`,
              opacity: box && (inside || jump) ? 1 : 0,
            }}
          />
          {options.map((option, i) => (
            <button
              key={option.value}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="mi-select-option"
              data-on={option.value === value}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => choose(option)}
            >
              {option.label}
              {option.hint ? <span>{option.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
