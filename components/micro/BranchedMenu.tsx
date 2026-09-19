'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const ROW = 36;
const PAD = 4;
const TRUNK = 14;
const R = 10;
const END = 34;
const INDENT = 40;

const rowY = (k: number) => PAD + k * ROW + ROW / 2;
const reach = (k: number) => `M ${TRUNK} 0 V ${rowY(k) - R} A ${R} ${R} 0 0 0 ${TRUNK + R} ${rowY(k)} H ${END}`;
const reachLength = (k: number) => rowY(k) - R + (Math.PI * R) / 2 + (END - TRUNK - R);

export interface TreeItem {
  id: string;
  label: string;
  hint?: string;
}

export interface TreeSection {
  id: string;
  label: string;
  items: TreeItem[];
}

interface Props {
  sections: TreeSection[];
  value: string;
  onChange: (id: string) => void;
  defaultOpen?: string[];
}

/**
 * The index down the side of the sheet.
 *
 * Opening a section draws the trunk and a branch out to each entry, in order,
 * so the structure assembles itself rather than appearing. A live line then
 * runs from the top of the trunk around the curve to whatever is selected:
 * at any moment the menu is drawing the path to where you are, which is the
 * one thing a nested menu usually leaves you to work out.
 */
export function BranchedMenu({ sections, value, onChange, defaultOpen }: Props) {
  const [open, setOpen] = useState<string[]>(
    () => defaultOpen ?? (sections[0] ? [sections[0].id] : []),
  );
  const [markerY, setMarkerY] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const headRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeSection = sections.find((s) => s.items.some((i) => i.id === value));
  const markerOn = Boolean(activeSection && open.includes(activeSection.id));

  useLayoutEffect(() => {
    const head = activeSection ? headRefs.current[activeSection.id] : null;
    if (!head) return;
    const place = () => setMarkerY(head.offsetTop + (head.offsetHeight - 16) / 2);
    place();
    const ro = new ResizeObserver(place);
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, open]);

  return (
    <nav ref={navRef} className="mi mi-tree" style={{ position: 'relative' }} aria-label="Archive index">
      <span className="mi-tree-marker" data-on={markerOn} style={{ transform: `translateY(${markerY}px)` }} />
      {sections.map((section) => {
        const isOpen = open.includes(section.id);
        return (
          <div key={section.id} className="mi-tree-section">
            <button
              ref={(el) => {
                headRefs.current[section.id] = el;
              }}
              type="button"
              className="mi-tree-head"
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((prev) => (prev.includes(section.id) ? prev.filter((id) => id !== section.id) : [...prev, section.id]))
              }
            >
              <svg className="mi-tree-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M4 2 L7 5 L4 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {section.label}
            </button>

            <div
              className="mi-tree-branch"
              style={{ height: isOpen ? section.items.length * ROW + PAD : 0 }}
            >
              <svg
                className="mi-tree-lines"
                width={INDENT}
                height={section.items.length * ROW + PAD}
                aria-hidden="true"
              >
                {section.items.map((item, k) => {
                  const len = reachLength(k);
                  const live = item.id === value;
                  return (
                    <g key={item.id}>
                      <path
                        className="mi-tree-line"
                        d={reach(k)}
                        strokeDasharray={len}
                        strokeDashoffset={isOpen ? 0 : len}
                        style={{ transitionDelay: isOpen ? `${k * 45}ms` : '0ms' }}
                      />
                      <path
                        className="mi-tree-line-live"
                        d={reach(k)}
                        strokeDasharray={len}
                        strokeDashoffset={isOpen && live ? 0 : len}
                      />
                    </g>
                  );
                })}
              </svg>

              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mi-tree-item"
                  style={{ height: ROW }}
                  data-on={item.id === value}
                  aria-current={item.id === value ? 'true' : undefined}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => onChange(item.id)}
                >
                  {item.label}
                  {item.hint ? <em>{item.hint}</em> : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
