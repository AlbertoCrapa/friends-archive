// ============================================================================
// GET /api/external-details?id=<external_id>
// Returns full normalized metadata for a single work, so selecting a suggestion
// can auto-fill fields the search list omits (director/runtime, developer, etc)
// plus the artwork link (already known from search — repeated here so an item
// linked before we stored artwork can refresh it with one call).
// Server-side (keeps keys off the client). Requires a session.
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getExternalDetails } from '@/lib/providers';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ metadata: null }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  if (!id) {
    return NextResponse.json({ metadata: null }, { status: 400 });
  }

  const details = await getExternalDetails(id);
  return NextResponse.json({
    metadata: details?.metadata ?? null,
    genre: details?.genre ?? null,
    image_url: details?.image_url ?? null,
  });
}
