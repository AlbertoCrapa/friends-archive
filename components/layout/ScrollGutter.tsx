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
      const width = usableWidth();

      if (!isLocked()) {
        // Unlocked is the truth: whatever the page is this wide now, that is
        // what every locked state has to match.
        baseline = width;
        if (applied !== 0) {
          applied = 0;
          root.style.removeProperty('padding-right');
        }
        return;
      }

      // Locked. If the lock handed the gutter back, the element got wider —
      // give that exact amount back as padding. If it did not, this is 0.
      const delta = Math.max(0, Math.round(width - baseline));
      if (delta === applied) return;
      applied = delta;
      if (delta === 0) root.style.removeProperty('padding-right');
      else root.style.setProperty('padding-right', `${delta}px`);
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
