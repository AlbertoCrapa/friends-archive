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
  sm: { frame: 'h-14 w-[38px]', icon: 'h-4 w-4' },
  md: { frame: 'h-[72px] w-12', icon: 'h-5 w-5' },
  lg: { frame: 'h-[84px] w-14', icon: 'h-5 w-5' },
  /** Grid card: fills its column and keeps the 2:3 frame. */
  xl: { frame: 'aspect-[2/3] w-full', icon: 'h-8 w-8' },
} as const;

interface Props {
  /** Provider-hosted artwork URL. Anything non-conforming renders as the glyph. */
  src?: string | null;
  type: MediaType;
  size?: keyof typeof SIZES;
  /**
   * Push the artwork in when the surrounding `group` is hovered.
   * `true`    — a list row: a definite 1.06 in 300ms, read as a response.
   * 'subtle'  — artwork that IS the tile: a 1.02 drift on the shared drift
   *             timing, slow enough and small enough that you notice it only
   *             on the picture you are actually looking at.
   */
  zoomOnHover?: boolean | 'subtle';
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
        'relative shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-stone-800 border border-white/[0.07]',
        frame,
        className
      )}
    >
      <span className="absolute inset-0 grid place-items-center text-stone-600">
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
          draggable={false}
          onLoad={() => setPaint((current) => (current === 'pending' ? 'faded' : current))}
          onError={() => setFailed(true)}
          className={cn(
            'relative h-full w-full object-cover',
            // `scale-100` is not decoration, it is the FROM of the animation.
            // Tailwind v4 writes zoom into the standalone `scale` property,
            // whose initial value is `none` — and Chrome will not interpolate
            // `none` into a number, it swaps it. Without a resting `scale: 1`
            // every "zoom on hover" in the app was a jump cut with a duration
            // written next to it that never ran.
            zoomOnHover === 'subtle'
              ? 'scale-100 group-hover:scale-[1.02]'
              : zoomOnHover
                ? 'scale-100 group-hover:scale-[1.06]'
                : '',
            // ONE transition declaration — two would collide and twMerge would
            // keep only the last. Opacity animates only for a real download; a
            // cache hit ('instant') must jump straight to full opacity.
            paint === 'faded'
              ? zoomOnHover
                ? 'transition-[opacity,scale]'
                : 'transition-opacity'
              : zoomOnHover
                ? 'transition-[scale]'
                : '',
            zoomOnHover === 'subtle'
              ? 'duration-[var(--duration-drift)] ease-[var(--ease-drift)]'
              : 'duration-300 ease-out',
            paint === 'pending' ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
    </div>
  );
}


/**
 * The artwork, blurred out of focus behind whatever it belongs to.
 *
 * A poster is mostly two or three colours, so a heavily blurred copy of it is
 * the cheapest honest way to tint a surface with the film's own palette: no
 * canvas, no pixel sampling, nothing to go wrong when the provider's CDN does
 * not send CORS headers. The mask keeps it to the side the artwork sits on so
 * the text never loses contrast.
 */
export function PosterGlow({
  src,
  shape = 'row',
  className,
}: {
  src?: string | null;
  /** 'row' fades out to the right; 'card' pools behind the whole tile. */
  shape?: 'row' | 'card';
  className?: string;
}) {
  const url = safeImageUrl(src);
  if (!url) return null;
  // A single fade, anchored to the edge the artwork sits against: full strength
  // where the poster is, gone by the time the text starts. Fading in *and* out
  // pinched the colour into a band across the middle instead.
  const mask =
    shape === 'row'
      ? 'linear-gradient(to right, black, transparent 44%)'
      : 'linear-gradient(to bottom, black, black 24%, transparent 84%)';
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        className={cn(
          'h-full w-full object-cover saturate-150',
          // Scaled well past the frame so the blur's own soft edge stays
          // outside it — at 1.35 the fringe fell inside and the colour read as
          // a puddle floating in the middle of the sheet.
          shape === 'row' ? 'scale-[1.6] opacity-[0.13] blur-2xl' : 'scale-[1.9] opacity-[0.3] blur-3xl'
        )}
      />
    </span>
  );
}
