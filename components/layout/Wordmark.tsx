// ============================================================================
// Wordmark — the name, set rather than typed.
//
// The mark next to it is two rings overlapping with a diamond in the shared
// middle. The name says the same thing with the two axes Bricolage Grotesque
// has and the app was not using: FRIEND is drawn NARROW and HEAVY so the
// letters crowd together, ARCHIVE is drawn WIDE and LIGHT so they stand apart,
// and the diamond sits on the join. Two words set as opposites, one shared
// point between them.
//
// "THE" is not part of that pair — it is an article, and it is set like one:
// half the size, wide-tracked, muted, out of the way of the two words that
// carry the name.
//
// The styles live in globals.css (`.wordmark*`) because the landing page, the
// app header and the footer all need the same lockup at three different sizes,
// and a size is the only thing that should differ between them.
// ============================================================================

interface Props {
  /**
   * Cap height of the two main words. Everything else — the article, the
   * diamond, every gap — is derived from it, so one number resizes the lockup
   * without redrawing its proportions.
   */
  size?: string;
  className?: string;
}

export function Wordmark({ size, className }: Props) {
  return (
    <span
      className={`wordmark${className ? ` ${className}` : ''}`}
      style={size ? ({ '--wm': size } as React.CSSProperties) : undefined}
    >
      {/* One accessible name for the whole lockup: the pieces below are
          decorative fragments of it, not five separate things to read out. */}
      <span className="sr-only">The Friend Archive</span>
      <span aria-hidden className="wordmark-the">
        The
      </span>
      <span aria-hidden className="wordmark-tight">
        Friend
      </span>
      <span aria-hidden className="wordmark-pivot" />
      <span aria-hidden className="wordmark-open">
        Archive
      </span>
    </span>
  );
}
