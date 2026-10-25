// ============================================================================
// GET /api/link-recognize?url=<social post link>
//
// A pasted post → every work it is about, each already matched to a provider:
//
//   1. read the post's caption + image (oEmbed, else og: tags)
//   2. Gemini Flash-Lite lists each work's category and official English title
//   3. the normal provider search for each title, best hit picked
//
// Returns { items: [{ recognized, work }] }. `work` null means the model named
// something the provider didn't find — the client still offers it, unlinked,
// by name. The member confirms or drops each one. Requires a session.
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchExternal } from '@/lib/providers';
import { fetchImageBase64, fetchLinkPreview } from '@/lib/providers/socialPreview';
import { recognizeWorks } from '@/lib/providers/gemini';
import { pickBest } from '@/lib/providers/pickBest';
import { rateGuard } from '@/lib/rateGuard';

/** Gemini's free tier is a small daily count shared by the whole app. */
const overBudget = rateGuard(8, 60_000);

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get('url')?.trim() ?? '';
  if (!url || url.length > 2048) {
    return NextResponse.json({ error: 'bad_url' }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (overBudget(user.id)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const preview = await fetchLinkPreview(url);
  if (!preview) {
    return NextResponse.json({ error: 'unreadable' }, { status: 422 });
  }

  const image = preview.imageUrl ? await fetchImageBase64(preview.imageUrl) : null;
  const recognized = await recognizeWorks(preview, image);
  if (recognized.length === 0) {
    return NextResponse.json({ error: 'not_recognized' }, { status: 422 });
  }

  // One search per work, in parallel. A list of games is a burst on RAWG's
  // monthly quota — recognizeWorks caps the list for exactly this reason.
  const matched = await Promise.all(
    recognized.map(async (r) => ({
      recognized: r,
      work: pickBest(await searchExternal(r.type, r.title), r.title, r.year),
    }))
  );

  // Two names for the same work ("Wallace & Gromit" / "The Curse of the
  // Were-Rabbit") can land on one provider id — keep the first.
  const seen = new Set<string>();
  const items = matched.filter(({ work }) => {
    if (!work) return true;
    if (seen.has(work.external_id)) return false;
    seen.add(work.external_id);
    return true;
  });

  return NextResponse.json({ items });
}
