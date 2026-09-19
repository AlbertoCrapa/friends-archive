'use client';

import type { ReactNode } from 'react';
import type { MediaType } from '@/types';
import { getStatusLabel } from '@/types';
import { StatusMark } from '@/components/micro/StatusMark';
import { WarmTooltip } from '@/components/micro/WarmTooltip';
import { MEMBERS, YOU, ratingsOf, type Entry } from './data';

export const SHORT: Record<MediaType, string> = {
  movie: 'Movie',
  tv_series: 'Series',
  book: 'Book',
  video_game: 'Game',
};

const GLYPH: Record<MediaType, ReactNode> = {
  movie: (
    <>
      <rect x="2.2" y="4.2" width="13.6" height="9.6" rx="1" />
      <path d="M5.6 4.2 v9.6" />
    </>
  ),
  tv_series: (
    <>
      <rect x="4.4" y="3.4" width="11.4" height="7.8" rx="1" />
      <path d="M2.2 6.6 v8 h10.4" />
    </>
  ),
  book: (
    <>
      <path d="M4 3.4 h9.8 v11.2 H4 z" />
      <path d="M6.3 3.4 v11.2" />
    </>
  ),
  video_game: (
    <>
      <rect x="2" y="6" width="14" height="7" rx="2.6" />
      <path d="M5.4 8.2 v2.6 M4.1 9.5 h2.6" />
      <circle cx="12.4" cy="9.5" r="0.95" />
    </>
  ),
};

/** What a thing is, as a glyph tile. The archive has no posters of its own:
 *  artwork belongs to the providers, so the list marks the kind instead. */
export function TypeStamp({ type, out }: { type: MediaType; out?: boolean }) {
  return (
    <span className="bl-stamp" data-out={out} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        {GLYPH[type]}
      </svg>
    </span>
  );
}

/** The row of members who have marked an item. Names are shown on the slip,
 *  where there is room, and carried by tooltips in the dense queue. */
export function MemberMarks({ entry, withNames = false }: { entry: Entry; withNames?: boolean }) {
  const rows = [
    { id: YOU, name: 'You', status: entry.yourStatus, rating: entry.yourRating || undefined },
    ...entry.marks.map((m) => ({
      id: m.memberId,
      name: MEMBERS.find((x) => x.id === m.memberId)?.name ?? m.memberId,
      status: m.status,
      rating: m.rating,
    })),
  ];

  return (
    <div className="bl-marks">
      {rows.map((row) => {
        const you = row.id === YOU;
        const detail = row.rating ? `${getStatusLabel(row.status)}, marked ${row.rating} of 5` : getStatusLabel(row.status);
        return (
          <WarmTooltip key={row.id} content={`${row.name}: ${detail.toLowerCase()}`}>
            <span
              className="bl-mark-chip"
              data-ink={you ? 'you' : 'group'}
              tabIndex={withNames ? 0 : undefined}
              role={withNames ? 'button' : undefined}
            >
              <StatusMark status={row.status} tone={you ? 'you' : 'group'} size={18} />
              {withNames ? <span className="bl-mark-name">{row.name}</span> : null}
            </span>
          </WarmTooltip>
        );
      })}
    </div>
  );
}

/**
 * The tally. Every rating on record is one translucent block of gold dropped
 * on the star it chose, and the blocks overlap: two marks on the same star
 * compound into a brighter band, yours lands at full strength. Nothing
 * computes a consensus score for the picture; the stacking is the picture.
 */
export function Tally({ entry, preview }: { entry: Entry; preview: number | null }) {
  const ratings = ratingsOf(entry);
  return (
    <div>
      <div className="bl-tally" role="img" aria-label={`${ratings.length} marks on record`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <div key={star} className="bl-tally-col">
            {ratings
              .filter((r) => r.rating === star)
              .map((r, i) => (
                <span
                  key={r.memberId}
                  className="bl-tally-mark"
                  data-ink={r.memberId === YOU ? 'you' : 'group'}
                  style={{ '--i': i } as React.CSSProperties}
                />
              ))}
            {preview === star && entry.yourRating !== star ? (
              <span
                className="bl-tally-mark"
                data-ink="you"
                data-ghost="true"
                style={{ '--i': ratings.filter((r) => r.rating === star).length } as React.CSSProperties}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="bl-tally-axis" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star}>{star}</span>
        ))}
      </div>
    </div>
  );
}
