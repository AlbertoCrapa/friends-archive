// ============================================
// GET /api/external-search?type=<media_type>&q=<query>
// Server-side proxy to external providers. Keeps API keys off the client and
// avoids CORS. Returns a normalized ExternalWork[] (never throws — an empty
// array means "fall back to manual entry").
// ============================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchExternal } from '@/lib/providers';
import type { MediaType } from '@/types';

const VALID_TYPES: MediaType[] = ['movie', 'tv_series', 'book', 'video_game'];

export async function GET(request: Request) {
  // Require an authenticated session so our provider keys aren't an open proxy.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const query = searchParams.get('q') ?? '';

  if (!type || !VALID_TYPES.includes(type as MediaType)) {
    return NextResponse.json({ results: [] }, { status: 400 });
  }

  const results = await searchExternal(type as MediaType, query);
  return NextResponse.json({ results });
}
