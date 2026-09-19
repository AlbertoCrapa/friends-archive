'use client';

import type { ItemStatus } from '@/types';
import { getStatusLabel } from '@/types';

interface Props {
  status: ItemStatus;
  /** Whose mark this is. 'you' prints in the personal ink, 'group' in the shared one. */
  tone?: 'you' | 'group';
  /** 0–1. Only read while 'consuming'; leave it out for an indeterminate arc. */
  progress?: number;
  size?: number;
  className?: string;
}

/**
 * One glyph for the four states a member can be in, morphing in place: a
 * dashed ring waits, an arc runs, a tick lands, a cross opts out. A row of
 * members then reads as a single alphabet rather than four unrelated icons,
 * which is the whole point when six people mark the same item.
 */
export function StatusMark({ status, tone = 'group', progress, size = 20, className }: Props) {
  const indeterminate = progress === undefined;
  const arc = Math.max(0.04, Math.min(1, progress ?? 0.28));

  return (
    <svg
      className={`mi mi-mark${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={getStatusLabel(status)}
      data-status={status}
      data-tone={tone}
      data-indeterminate={indeterminate}
    >
      <circle className="mi-mark-track" cx="10" cy="10" r="9" />
      <circle className="mi-mark-ring" cx="10" cy="10" r="8" />
      <circle
        className="mi-mark-arc"
        cx="10"
        cy="10"
        r="8"
        pathLength={1}
        strokeDasharray={`${indeterminate ? 0.3 : arc} 1`}
      />
      <path className="mi-mark-glyph" data-glyph="check" d="M6 10.3 L8.9 13.1 L14.2 7.2" />
      <path className="mi-mark-glyph" data-glyph="cross" d="M7.1 7.1 L12.9 12.9 M12.9 7.1 L7.1 12.9" />
    </svg>
  );
}
