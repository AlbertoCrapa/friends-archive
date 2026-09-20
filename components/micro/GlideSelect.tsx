'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export interface GlideOption {
  value: string;
  label: string;
  hint?: string;
  /** Leading glyph or swatch. What the value looks like, shown beside its name. */
  icon?: ReactNode;
}

interface Props {
  options: GlideOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown before the value on the trigger. A string is dimmed as a field name;
   *  a node is rendered as given, which is how a status dot rides along. */
  label?: ReactNode;
  /** Needed when there is no visible label. */
  ariaLabel?: string;
  /**
   * Drop the value's word from the trigger and keep only the label node and
   * the caret. For grids dense enough that a word would not fit.
   */
  compact?: boolean;
  align?: 'left' | 'right';
}

/** Row height + padding, used to guess the menu's height before it exists. */
const ROW = 30;
const PAD = 8;
const GAP = 6;
const MENU_W = 200;

/**
 * A select whose menu pops out of the corner it hangs from, and whose single
 * highlight glides between rows rather than blinking from one to the next.
 *
 * The menu is rendered in a PORTAL rather than next to its trigger. Every
 * surface this control sits on — a swipe row, a grid card — clips its own
 * overflow to keep artwork inside a rounded corner, and a menu that renders
 * inside that box gets clipped with it. Anchored to the trigger's position on
 * screen, the menu belongs to the page instead of to the card.
 */
export function GlideSelect({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  compact,
  align = 'left',
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const [box, setBox] = useState<{ y: number; h: number } | null>(null);
  const [jump, setJump] = useState(true);
  const [inside, setInside] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    side: 'bottom' | 'top';
    align: 'left' | 'right';
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => setMounted(true), []);

  // Where the menu hangs. Measured from the trigger's box on screen, and
  // flipped whenever the obvious side would put it off the edge.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = options.length * ROW + PAD;
      const room = window.innerHeight - rect.bottom - GAP;
      const side: 'bottom' | 'top' = room < height && rect.top > room ? 'top' : 'bottom';
      let side_align = align;
      if (align === 'left' && rect.left + MENU_W > window.innerWidth - 8) side_align = 'right';
      if (align === 'right' && rect.right - MENU_W < 8) side_align = 'left';
      setAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, side, align: side_align });
    };
    place();
    // Capture phase: the trigger may live inside a scroller of its own.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [align, open, options.length]);

  // Place the highlight on whatever is active. The first placement after
  // opening jumps; everything after it glides.
  useLayoutEffect(() => {
    if (!open) return;
    const el = optionRefs.current[active];
    const menu = menuRef.current;
    if (!el || !menu) return;
    setBox({ y: el.offsetTop - menu.clientTop - 3, h: el.offsetHeight });
  }, [active, anchor, open]);

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
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (option: GlideOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const menu = anchor ? (
    <div
      className="mi mi-select mi-select-anchor"
      style={{
        left: anchor.left,
        top: anchor.top,
        width: anchor.width,
        height: anchor.height,
      }}
    >
      <div
        ref={menuRef}
        className="mi-select-menu"
        data-align={anchor.align}
        data-side={anchor.side}
        role="listbox"
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : 'Options')}
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
            <span className="mi-select-name">
              {option.icon}
              {option.label}
            </span>
            {option.hint ? <span className="mi-select-hint">{option.hint}</span> : null}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="mi mi-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`mi-select-trigger${compact ? ' mi-select-trigger-compact' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          ariaLabel ?? (typeof label === 'string' ? label : undefined) ?? selected?.label
        }
        title={compact ? selected?.label : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label === undefined || label === null || label === false ? null : typeof label === 'string' ? (
          <span style={{ opacity: 0.55 }}>{label}</span>
        ) : (
          label
        )}
        {compact ? null : selected?.label}
        <svg className="mi-select-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
