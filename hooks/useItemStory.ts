'use client';

// ============================================================================
// useItemStory — the synopsis and everything else that is not ours, read once.
//
// THE RULE THIS HOOK EXISTS TO KEEP: opening an item may cost one provider
// call, the FIRST time anybody opens it. Opening it again — later, after a
// reload, by another friend, on another page — must cost nothing.
//
// Four layers stand in front of the provider, cheapest first:
//
//   1. this module's Map          — the rest of the session, free
//   2. localStorage, 7 days       — reloads and later visits, free
//   3. Next's fetch cache, 1 day  — SHARED BETWEEN USERS, on the server
//   4. the provider               — reached only when all three miss
//
// and a promise map, so two components asking at the same moment make one
// request between them.
//
// Manual items (no external_id) never reach any of this: there is nothing to
// ask about, and the sheet renders what the group wrote itself.
// ============================================================================

import { useEffect, useState } from 'react';
import type { ItemStory } from '@/types';
import { ITEM_STORY_VERSION } from '@/types';

/**
 * How long a cached story stays good in the browser.
 *
 * A week, not the month this used to be, and the reason is the `where` block:
 * a synopsis is true forever, but a film leaves Netflix on a Tuesday and a
 * stale "watch it on Prime" chip sends a friend to a page that no longer has
 * it. A week is the longest a wrong answer there is still a small
 * embarrassment rather than a broken promise — and it costs nothing, because
 * the server's day-long cache is shared between everybody in the group.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Cache keys carry the schema version, so an older shape is simply ignored. */
const KEY_PREFIX = `tfa.story.v${ITEM_STORY_VERSION}.`;
/** Keeps the localStorage footprint bounded on a heavily browsed archive. */
const MAX_STORED = 120;

type Entry = { story: ItemStory | null; at: number };

const memory = new Map<string, Entry>();
const inFlight = new Map<string, Promise<ItemStory | null>>();

function storageKey(externalId: string) {
  return `${KEY_PREFIX}${externalId}`;
}

function readStored(externalId: string): Entry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(externalId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    if (typeof parsed?.at !== 'number') return null;
    if (Date.now() - parsed.at > TTL_MS) {
      window.localStorage.removeItem(storageKey(externalId));
      return null;
    }
    return parsed;
  } catch {
    // Private mode, disabled storage, a half-written entry — all the same
    // answer: we simply do not have it cached.
    return null;
  }
}

function writeStored(externalId: string, entry: Entry) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(externalId), JSON.stringify(entry));
  } catch {
    // Out of quota (or storage refused): drop the oldest half of OUR keys and
    // try once more. Nothing else in the app is touched.
    try {
      const keys: Array<{ key: string; at: number }> = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith(KEY_PREFIX)) continue;
        const raw = window.localStorage.getItem(key);
        const at = raw ? ((JSON.parse(raw) as Entry).at ?? 0) : 0;
        keys.push({ key, at });
      }
      keys.sort((a, b) => a.at - b.at);
      for (const { key } of keys.slice(0, Math.max(1, Math.ceil(keys.length / 2)))) {
        window.localStorage.removeItem(key);
      }
      window.localStorage.setItem(storageKey(externalId), JSON.stringify(entry));
    } catch {
      // Still no room: the memory cache alone will do for this session.
    }
  }
}

/** Trim our own keys back under the cap. Runs after a write, never blocking. */
function pruneStored() {
  if (typeof window === 'undefined') return;
  try {
    const keys: Array<{ key: string; at: number }> = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      keys.push({ key, at: raw ? ((JSON.parse(raw) as Entry).at ?? 0) : 0 });
    }
    if (keys.length <= MAX_STORED) return;
    keys.sort((a, b) => a.at - b.at);
    for (const { key } of keys.slice(0, keys.length - MAX_STORED)) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Nothing to do — a cache that cannot be trimmed is still a cache.
  }
}

async function loadStory(externalId: string): Promise<ItemStory | null> {
  const pending = inFlight.get(externalId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(`/api/item-story?id=${encodeURIComponent(externalId)}`);
      // 429 is the endpoint's own guard. Treat it like any other miss: the
      // sheet shows what we already know, and the next open tries again.
      if (!res.ok) return null;
      const data = (await res.json()) as { story: ItemStory | null };
      return data.story ?? null;
    } catch {
      return null;
    } finally {
      inFlight.delete(externalId);
    }
  })();

  inFlight.set(externalId, request);
  return request;
}

export type StoryState = 'none' | 'loading' | 'ready' | 'unavailable';

/**
 * The story for one linked item.
 *
 * `enabled` is how the sheet pays for nothing it does not show: the hook is
 * mounted with the rest of the panel but stays inert until the panel is
 * actually open, so scrolling a list of sixty rows never reaches the network.
 */
export function useItemStory(externalId: string | null, enabled: boolean) {
  const [story, setStory] = useState<ItemStory | null>(null);
  const [state, setState] = useState<StoryState>('none');

  useEffect(() => {
    if (!enabled || !externalId) return;

    const cached = memory.get(externalId) ?? readStored(externalId);
    if (cached) {
      memory.set(externalId, cached);
      setStory(cached.story);
      setState(cached.story ? 'ready' : 'unavailable');
      return;
    }

    let alive = true;
    setState('loading');
    void loadStory(externalId).then((next) => {
      const entry: Entry = { story: next, at: Date.now() };
      // A miss is remembered for the SESSION only, never written to storage.
      //
      // Open Library in particular answers 503 often enough that we measured it
      // while building this — persisting "nothing to say" would leave a book
      // blank for a month because of one bad minute on their side. In memory it
      // still stops the same open from asking twice, and a reload tries again.
      memory.set(externalId, entry);
      if (next) {
        writeStored(externalId, entry);
        pruneStored();
      }
      if (!alive) return;
      setStory(next);
      setState(next ? 'ready' : 'unavailable');
    });

    return () => {
      alive = false;
    };
  }, [externalId, enabled]);

  return { story, state };
}
