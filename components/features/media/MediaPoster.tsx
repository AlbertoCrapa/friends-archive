'use client';

// ============================================================================
// MediaPoster — the item's artwork tile (poster / cover / key art).
//
// The image is a LINK to the provider's CDN, never a copy in our own storage,
// so this component has to survive a URL that is slow, gone, or simply absent:
//  • the type glyph is painted UNDERNEATH every poster, so a missing, pending
//    or broken image still reads as "movie" / "book" / … instead of a hole;
//  • the artwork fades in once decoded, so a list never flashes half-drawn;
//  • safeImageUrl() drops anything that isn't a provider image host.
//
// CACHING. The providers already serve these files with a one-year immutable
// cache (TMDB `max-age=31919000`, RAWG `max-age=31536000`), so after the first
// visit the browser paints them from its own disk cache with no network at all
// — a second cache of our own would only duplicate that, worse. What DID make
// them look reloaded every time was this component: it started every mount at
// opacity 0 and faded in, so an image that was already decoded still animated
// on every navigation. An image that is `complete` at mount is therefore shown
// at once, with no transition — the fade is kept only for a genuine download.
//
// Every tile keeps the same 2:3 portrait frame — including landscape game key
// art, which is centre-cropped — because a list reads on its alignment.
// ============================================================================

import { useCallback, useState } from 'react';
import { BookOpen, Clapperboard, Gamepad2, Tv } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MediaType } from '@/types';
import { cn, safeImageUrl } from '@/lib/utils';

/** One glyph per media type — the fallback face of every artwork tile. */
export const TYPE_ICONS: Record<MediaType, LucideIcon> = {
  movie: Clapperboard,
  tv_series: Tv,
  book: BookOpen,
  video_game: Gamepad2,
};

/** Frame sizes, all 2:3. xs = suggestion row, sm = table row, md = mobile card, lg = dialog. */
const SIZES = {
  xs: { frame: 'h-10 w-7', icon: 'h-3 w-3' },
  sm: { frame: 'h-12 w-8', icon: 'h-3.5 w-3.5' },
  md: { frame: 'h-[72px] w-12', icon: 'h-5 w-5' },
  lg: { frame: 'h-[84px] w-14', icon: 'h-5 w-5' },
} as const;

interface Props {
  /** Provider-hosted artwork URL. Anything non-conforming renders as the glyph. */
  src?: string | null;
  type: MediaType;
  size?: keyof typeof SIZES;
  /** Lift the artwork slightly when the surrounding `group` row is hovered. */
  zoomOnHover?: boolean;
  /**
   * Above the fold: load immediately instead of waiting for the lazy-load
   * observer, so the first screenful never arrives late on a cold cache.
   */
  priority?: boolean;
  className?: string;
}

/**
 * 'pending' — nothing decoded yet (glyph showing).
 * 'instant' — the browser had it cached and it was already decoded at mount:
 *             show it with NO animation, which is what makes a revisit feel
 *             like the posters were never loading at all.
 * 'faded'   — it really came off the network, so it fades in once.
 */
type Paint = 'pending' | 'instant' | 'faded';

export function MediaPoster({
  src,
  type,
  size = 'sm',
  zoomOnHover = false,
  priority = false,
  className,
}: Props) {
  const url = safeImageUrl(src);
  const [paint, setPaint] = useState<Paint>('pending');
  const [failed, setFailed] = useState(false);
  const Icon = TYPE_ICONS[type] ?? Clapperboard;
  const { frame, icon } = SIZES[size];

  // A cached image finishes decoding before React can attach onLoad, so the
  // event never fires and only the element itself knows. The ref callback runs
  // at commit and asks it directly.
  const measure = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setPaint('instant');
  }, []);

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden border border-stone-800/70 bg-stone-900/80',
        frame,
        className
      )}
    >
      <span className="absolute inset-0 grid place-items-center text-stone-700">
        <Icon className={icon} aria-hidden="true" />
      </span>
      {url && !failed && (
        // Decorative: the title always sits next to the tile, so announcing the
        // artwork again would only duplicate it for screen readers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={measure}
          src={url}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setPaint((current) => (current === 'pending' ? 'faded' : current))}
          onError={() => setFailed(true)}
          className={cn(
            'relative h-full w-full object-cover',
            zoomOnHover && 'group-hover:scale-[1.06]',
            // ONE transition declaration — two would collide and twMerge would
            // keep only the last. Opacity animates only for a real download; a
            // cache hit ('instant') must jump straight to full opacity.
            paint === 'faded'
              ? zoomOnHover
                ? 'transition-[opacity,transform] duration-300 ease-out'
                : 'transition-opacity duration-300 ease-out'
              : zoomOnHover
                ? 'transition-transform duration-300 ease-out'
                : '',
            paint === 'pending' ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
    </div>
  );
}
