// ============================================================================
// GET /api/item-story?id=<external_id>
//
// The synopsis, the world's score, the billed names and the time cost for one
// linked work — everything the item sheet shows that is not ours. Server-side,
// so provider keys stay off the client. Requires a session.
//
// WHY THIS IS CHEAP, in three layers, none of which is a database:
//
//  1. Next's fetch cache (24h, in lib/providers/story.ts). It lives on the
//     server and is SHARED BETWEEN USERS: the first friend to open a title that
//     day pays the provider call, the rest are served from here.
//  2. The browser: this response is privately cacheable for a day, and the
//     client keeps its own copy in memory and localStorage for a week
//     (hooks/useItemStory.ts).
//  3. The rate guard below, which exists only so one authenticated client
//     cannot loop this endpoint and spend a provider quota on everybody's
//     behalf.
//
// The free tiers this has to live inside:
//   TMDB          — free, no daily cap, rate-limited per second. Attribution
//                   required, which the sheet prints as "Story from TMDB".
//   RAWG          — 20,000 requests a MONTH on the free key. The binding one,
//                   and the reason for every layer above.
//   Open Library  — no key, no published cap, asks for a descriptive
//                   User-Agent and modest volume (we send both).
//
// A 200-title archive opened daily by six friends costs at most ~200 upstream
// calls a month, because the day cache collapses the six into one.
//
// ARTWORK IS NOT FETCHED HERE. Posters are links to the provider CDN, stored on
// the item and served from the browser's disk cache on every later visit — see
// DATA_MODEL § 6.10. The sheet asks the CDN for a larger size of the SAME file
// once, when you open an item, and never again.
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getExternalStory } from '@/lib/providers';

/** Per-user ceiling: a human opening items cannot get near it, a loop does. */
const MAX_PER_WINDOW = 40;
const WINDOW_MS = 60_000;

/**
 * Per-instance, not global — serverless gives each instance its own memory, so
 * this bounds a hot instance rather than the whole deployment. That is the
 * right size for the job: the shared fetch cache already absorbs repeats, and
 * this only has to stop one client from hammering cache MISSES.
 */
const seen = new Map<string, { count: number; windowStart: number }>();

function overBudget(userId: string): boolean {
  const now = Date.now();
  const entry = seen.get(userId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    seen.set(userId, { count: 1, windowStart: now });
    // Opportunistic sweep: the map only ever holds users seen this minute.
    if (seen.size > 500) {
      for (const [key, value] of seen) {
        if (now - value.windowStart > WINDOW_MS) seen.delete(key);
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ story: null }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  // Namespaced provider ids only ("tmdb:movie:693134"), nothing else reaches a
  // provider — the id is interpolated into their URL.
  if (!/^[a-z]+:[a-z]+:[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ story: null }, { status: 400 });
  }

  if (overBudget(user.id)) {
    return NextResponse.json({ story: null }, { status: 429 });
  }

  const story = await getExternalStory(id);

  return NextResponse.json(
    { story },
    {
      headers: {
        // Private: it is behind a session. A day: the same window the server
        // cache uses, so a reload costs nothing either.
        'Cache-Control': 'private, max-age=86400',
      },
    }
  );
}
