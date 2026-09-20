// ============================================================================
// Wordmark — the mark and the name, as one lockup.
//
// THE MARK. Two friends as two interlocking rings: one in the page's ink, one
// in gold, woven so that neither is simply printed over the other — the ink
// ring crosses in front at the bottom, the gold in front at the top. It is
// drawn flat, with no plate behind it: the old mark carried its own dark tile
// and a 1px outline, which on a dark bar is a box inside a box, and it shrank
// two rings, a weave and a diamond into 24 pixels where they turned to mush.
// The diamond is gone for the same reason.
//
// THE NAME. One size, one width, one weight — the two words are separated by
// ink alone, which is the same idea the rings state in colour. The previous
// lockup set an article in tracked-out capitals, FRIEND condensed at 700, a
// rotated gold square and ARCHIVE wide at 300, all inside 130 pixels: four
// typographic arguments at a size where none of them can be heard.
//
// Every dimension derives from `--wm` (the cap height of the name), so one
// number resizes the whole lockup without redrawing its proportions. The
// styles live in globals.css (`.wordmark*`) because the app header, the
// landing nav and anything else that shows the brand must share them.
// ============================================================================

interface Props {
  /** Cap height of the name; the rings and every gap follow it. */
  size?: string;
  /** Below `sm`, show the rings alone and let the nav have the room. */
  compact?: boolean;
  className?: string;
}

/**
 * Ring geometry, in a 32×20 box.
 *
 * Centres 10 apart with r 8 — they overlap by more than half a radius, which
 * is what makes them read as two people and not as a chain link. The third
 * path is the weave: a 45° segment of the LEFT ring, repainted after the gold
 * one so it crosses in front at the lower intersection (16, 16.245). Round
 * caps hide where the repaint starts and stops.
 */
const RING_STROKE = 2.25;

export function Wordmark({ size, compact = false, className }: Props) {
  return (
    <span
      className={`wordmark${className ? ` ${className}` : ''}`}
      data-compact={compact ? 'true' : undefined}
      style={size ? ({ '--wm': size } as React.CSSProperties) : undefined}
    >
      {/* One accessible name for the whole lockup: the rings and the two words
          are fragments of it, not three things to read out. */}
      <span className="sr-only">The Friend Archive</span>

      <svg
        className="wordmark-mark"
        viewBox="0 0 32 20"
        fill="none"
        strokeWidth={RING_STROKE}
        aria-hidden="true"
      >
        <circle className="wordmark-ring-ink" cx="11" cy="10" r="8" />
        <circle className="wordmark-ring-gold" cx="21" cy="10" r="8" />
        <path
          className="wordmark-ring-ink"
          d="M17.93 14 A8 8 0 0 1 13.07 17.73"
          strokeLinecap="round"
        />
      </svg>

      <span aria-hidden className="wordmark-name">
        <span className="wordmark-name-strong">Friend</span>
        <span className="wordmark-name-soft">Archive</span>
      </span>
    </span>
  );
}
