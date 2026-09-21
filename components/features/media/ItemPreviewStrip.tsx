'use client';

import { MediaPoster } from './MediaPoster';
import type { MediaItemWithDetails } from '@/types';

/** Covers shown before the strip starts counting instead. */
const PREVIEW_LIMIT = 5;

/**
 * What is in your hands, at the head of a dialog that is about to do something
 * to it.
 *
 * Overlapped like a held hand of cards rather than laid out in a row: the point
 * is not to let you read all forty, it is to let you recognise the handful you
 * picked and notice immediately if one of them is not what you meant. The
 * titles follow in words, because artwork alone cannot be checked against a
 * memory of what you tapped.
 */
export function ItemPreviewStrip({ items }: { items: MediaItemWithDetails[] }) {
  const shown = items.slice(0, PREVIEW_LIMIT);
  const extra = items.length - shown.length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0">
        {shown.map((item, index) => (
          <span
            key={item.id}
            className="rounded-[var(--radius-sm)] ring-2 ring-[var(--color-surface-elevated)]"
            style={{ marginLeft: index === 0 ? 0 : -14, zIndex: shown.length - index }}
          >
            <MediaPoster src={item.image_url} type={item.type} size="sm" />
          </span>
        ))}
      </div>
      <p className="min-w-0 text-[12.5px] leading-relaxed text-stone-500">
        {shown.map((item) => item.title).join(', ')}
        {extra > 0 ? ` and ${extra} more` : ''}
      </p>
    </div>
  );
}
