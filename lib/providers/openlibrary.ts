// ============================================
// Open Library adapter — books
// Server-only. No API key required. Normalizes search.json into ExternalWork[].
// ============================================

import type { ExternalWork } from '@/types';
import { fetchJson } from './http';

interface OpenLibraryDoc {
  key?: string; // e.g. "/works/OL45804W"
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[];
}

/** Extract the bare work id (OL…W) from an Open Library key path. */
function workIdFrom(key?: string): string | null {
  if (!key) return null;
  const match = key.match(/OL\w+W/);
  return match ? match[0] : null;
}

export async function searchOpenLibrary(query: string): Promise<ExternalWork[]> {
  const url =
    'https://openlibrary.org/search.json' +
    `?title=${encodeURIComponent(query)}&limit=8` +
    '&fields=key,title,author_name,first_publish_year,cover_i';

  const data = await fetchJson<OpenLibraryResponse>(url);

  return (data?.docs ?? [])
    .map((doc) => {
      const workId = workIdFrom(doc.key);
      if (!workId || !doc.title) return null;
      const author = doc.author_name?.[0];
      const year = doc.first_publish_year;
      return {
        external_id: `openlibrary:book:${workId}`,
        external_source: 'openlibrary',
        external_url: `https://openlibrary.org/works/${workId}`,
        type: 'book',
        title: doc.title,
        year,
        subtitle: [author, year ? String(year) : null].filter(Boolean).join(' · ') || undefined,
        image_url: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`
          : undefined,
        metadata: {
          ...(author ? { author } : {}),
          ...(year ? { publication_year: year } : {}),
        },
      } satisfies ExternalWork;
    })
    .filter((work): work is NonNullable<typeof work> => work !== null);
}
