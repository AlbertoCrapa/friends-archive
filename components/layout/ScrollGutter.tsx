'use client';

// ============================================================================
// ScrollGutter — the last line of defence for the page's width.
//
// The CSS in globals.css already reserves the scrollbar's strip permanently
// (`overflow-y: scroll` + `scrollbar-gutter: stable`), which is the correct
// fix and, on a browser that behaves, the only one needed. This exists because
// the one case that fix depends on a SPEC DETAIL is the case that happens
// forty times a session: every dropdown, select, dialog and item sheet in this
// app locks scrolling by turning <html> into `overflow: hidden`, and whether
// the reserved gutter survives that is a question different engines have
// answered differently over the years. When it does not survive, the page
// silently widens by the scrollbar's width for as long as a menu is open —
// which reads as the whole layout twitching sideways every time you click
// anything.
//
// So rather than trusting the answer, this measures it. On every lock and
// unlock it compares the element's usable width against the width it had while
// unlocked, and pads back exactly the difference — nothing more. On a browser
// where the CSS already holds, the difference is zero and this does nothing at
// all; there is no way for it to double-compensate, because it is not
// guessing at a scrollbar width, it is measuring one number against another.
// ============================================================================

import { useEffect } from 'react';

export function ScrollGutter() {
  useEffect(() => {
    const root = document.documentElement;

    /** The padding we are currently adding, so it can be measured out again. */
    let applied = 0;
    /** The usable width while nothing is locked. The number to hold on to. */
    let baseline = root.clientWidth;

    const usableWidth = () => root.clientWidth - applied;
    const isLocked = () => document.body.hasAttribute('data-scroll-locked');

    const sync = () => {
      if (!isLocked()) {
        // Unlocked is the truth. Take the compensation off FIRST, then read —
        // whatever the page is this wide with nothing added, that is the width
        // every locked state has to match.
        if (applied !== 0) {
          applied = 0;
          root.style.removeProperty('padding-right');
        }
        baseline = root.clientWidth;
        return;
      }

      // Locked. `clientWidth` is the padding box, so it ALREADY contains the
      // padding we put there — which is why this correction is cumulative
      // rather than recomputed from nothing. Read plainly, a correctly
      // compensated page measures exactly the baseline and looks to a fresh
      // calculation like a page that needs no compensation at all, so every
      // sync after the first would hand the gutter straight back. (Radix fires
      // at least one more: it sets `pointer-events` on the body an instant
      // after the lock lands, and that is a style mutation like any other.)
      // Keeping what is applied and adding only the remaining drift is stable
      // under any number of repeats.
      const drift = usableWidth() - baseline;
      const next = Math.max(0, applied + drift);
      if (next === applied) return;
      applied = next;
      if (next === 0) root.style.removeProperty('padding-right');
      else root.style.setProperty('padding-right', `${next}px`);
    };

    // The lock announces itself on the body (react-remove-scroll, under every
    // Radix overlay in the app). Watching `style` too catches the library's own
    // gap compensation, which globals.css cancels.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-scroll-locked', 'style'],
    });

    // A resize changes the baseline — but only a resize that happens while
    // nothing is locked can be trusted to establish one.
    const onResize = () => {
      if (isLocked()) return;
      sync();
    };
    window.addEventListener('resize', onResize);

    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      root.style.removeProperty('padding-right');
    };
  }, []);

  return null;
}
