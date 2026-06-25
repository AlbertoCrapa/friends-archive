'use client';

// ============================================================================
// useExternalSearch — debounced, cooldown-throttled, quota-capped autocomplete.
//
// The whole app shares ONE free quota per provider (RAWG is only 20k req/MONTH
// for ALL users combined), so this hook is deliberately stingy:
//
//  • DEBOUNCE  — waits until the user stops typing before any call fires.
//  • COOLDOWN  — enforces a minimum gap between two real network calls.
//  • CACHE     — identical queries are served from memory, never re-fetched.
//  • SESSION CAP — each "add/edit item" session can make only N calls; games
//                  (RAWG) are capped hardest. A browser-wide RAWG ceiling is a
//                  second safety net across all sessions in the tab.
//
// When a cap is hit, search stops and the UI tells the user to add manually.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExternalWork, MediaType } from '@/types';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 1200; // wait after the last keystroke
const COOLDOWN_MS = 2000; // minimum gap between two real network calls

// Per add/edit-item session (resets each time the dialog opens).
const MAX_CALLS_PER_SESSION: Record<MediaType, number> = {
  movie: 30,
  tv_series: 30,
  book: 30,
  video_game: 12, // RAWG is the scarcest quota — keep this low
};

// Extra safety net for RAWG across ALL sessions in this browser tab.
const RAWG_TAB_SESSION_CAP = 50;
let rawgTabSessionCalls = 0;

// In-memory cache shared across the tab. Key: `${type}:${query}`.
const responseCache = new Map<string, ExternalWork[]>();

export interface ExternalSearchState {
  results: ExternalWork[];
  isSearching: boolean;
  /** A quota/cap was hit — stop searching, fall back to manual. */
  limitReached: boolean;
  /** A provider call failed (timeout/network/down) — fall back to manual. */
  unavailable: boolean;
  /** Calls left in this session for the current type (for transparency). */
  callsRemaining: number;
  /** Reset the per-session counter — call when the dialog (re)opens. */
  reset: () => void;
}

export function useExternalSearch(
  type: MediaType,
  query: string,
  enabled: boolean
): ExternalSearchState {
  const [results, setResults] = useState<ExternalWork[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [callsMade, setCallsMade] = useState(0);

  const callsMadeRef = useRef(0);
  const lastCallAtRef = useRef(0);

  const reset = useCallback(() => {
    callsMadeRef.current = 0;
    setCallsMade(0);
    setLimitReached(false);
    setUnavailable(false);
    setResults([]);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Disabled (e.g. an item was just linked) — make sure no stale spinner
      // keeps the submit button locked.
      setIsSearching(false);
      return;
    }

    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setIsSearching(false);
      setUnavailable(false);
      return;
    }

    // Cache hit — instant, free, no counter touched.
    const cacheKey = `${type}:${q.toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setIsSearching(false);
      setUnavailable(false);
      return;
    }

    // Quota gate — refuse to call past the caps.
    const sessionCapHit = callsMadeRef.current >= MAX_CALLS_PER_SESSION[type];
    const rawgCapHit = type === 'video_game' && rawgTabSessionCalls >= RAWG_TAB_SESSION_CAP;
    if (sessionCapHit || rawgCapHit) {
      setLimitReached(true);
      setIsSearching(false);
      return;
    }

    // Show the loading graphic immediately, but delay the real call by the
    // larger of the debounce window and the remaining cooldown.
    setIsSearching(true);
    const sinceLast = Date.now() - lastCallAtRef.current;
    const wait = Math.max(DEBOUNCE_MS, COOLDOWN_MS - sinceLast);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      lastCallAtRef.current = Date.now();
      callsMadeRef.current += 1;
      setCallsMade(callsMadeRef.current);
      if (type === 'video_game') rawgTabSessionCalls += 1;

      try {
        const res = await fetch(
          `/api/external-search?type=${type}&q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('search failed');
        const data = (await res.json()) as { results: ExternalWork[] };
        const list = data.results ?? [];
        responseCache.set(cacheKey, list);
        setResults(list);
        setUnavailable(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setResults([]);
        setUnavailable(true);
      } finally {
        setIsSearching(false);
      }
    }, wait);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, type, enabled]);

  const callsRemaining = Math.max(0, MAX_CALLS_PER_SESSION[type] - callsMade);

  return { results, isSearching, limitReached, unavailable, callsRemaining, reset };
}
