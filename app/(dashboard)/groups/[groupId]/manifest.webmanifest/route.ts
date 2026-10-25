// ============================================
// GET /groups/<id>/manifest.webmanifest?name=<group name>
// One installable app per group: its own id, start page and scope, so two
// groups on one home screen are two icons that each open their own archive.
//
// The name rides in the query rather than being read from the database:
// browsers fetch manifests WITHOUT cookies, so RLS would hide a private
// group's name from this route anyway. It is only a label.
// ============================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const name = new URL(request.url).searchParams.get('name')?.trim().slice(0, 60) || 'The Friend Archive';
  const base = `/groups/${encodeURIComponent(groupId)}`;

  return Response.json(
    {
      id: base,
      name,
      short_name: name.slice(0, 15),
      start_url: base,
      scope: base,
      display: 'standalone',
      background_color: '#0c0a09',
      theme_color: '#0c0a09',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
