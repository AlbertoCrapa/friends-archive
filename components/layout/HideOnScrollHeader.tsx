'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Slides the sticky header away while scrolling down and back on any upward
// scroll. Also flags <html data-nav-hidden> so other sticky bars pinned under
// the header (ArchiveControls) can slide up into the freed space.
export function HideOnScrollHeader({ className, children }: { className?: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // Small dead zone so trackpad jitter doesn't flicker the bar.
      if (Math.abs(y - lastY) < 8) return;
      setHidden(y > lastY && y > 64);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-nav-hidden', hidden);
    return () => document.documentElement.removeAttribute('data-nav-hidden');
  }, [hidden]);

  return (
    <header
      className={cn(
        'transition-transform duration-300 ease-out motion-reduce:transition-none',
        hidden && '-translate-y-full',
        className,
      )}
      // Keyboard users tabbing into a hidden bar get it back.
      onFocusCapture={() => setHidden(false)}
    >
      {children}
    </header>
  );
}
