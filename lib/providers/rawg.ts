// ============================================
// RAWG adapter — video games
// Server-only. Normalizes RAWG /games search into ExternalWork[].
// ============================================

import type { ExternalWork, VideoGameMetadata } from '@/types';
import { fetchJson } from './http';

interface RawgResult {
  id: number;
  slug?: string;
  name?: string;
  released?: string; // "YYYY-MM-DD"
  background_image?: string | null;
}

interface RawgResponse {
  results?: RawgResult[];
}

function yearFrom(date?: string): number | undefined {
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

export async function searchRawg(query: string): Promise<ExternalWork[]> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return [];

  const url =
    'https://api.rawg.io/api/games' +
    `?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=8`;

  const data = await fetchJson<RawgResponse>(url);

  return (data?.results ?? [])
    .map((r) => {
      if (!r.name) return null;
      const year = yearFrom(r.released);
      const slug = r.slug ?? String(r.id);
      return {
        external_id: `rawg:game:${r.id}`,
        external_source: 'rawg',
        external_url: `https://rawg.io/games/${slug}`,
        type: 'video_game',
        title: r.name,
        year,
        subtitle: year ? String(year) : undefined,
        image_url: r.background_image ?? undefined,
        metadata: year ? { release_year: year } : {},
      } satisfies ExternalWork;
    })
    .filter((work): work is NonNullable<typeof work> => work !== null);
}

// ── Detail lookup (developer/publisher/platforms not in the search list) ──────

interface RawgGameDetails {
  released?: string;
  developers?: Array<{ name?: string; slug?: string }>;
  publishers?: Array<{ name?: string }>;
  platforms?: Array<{ platform?: { name?: string } }>;
}

/**
 * Fetch full metadata for one RAWG game so the developer (and publisher /
 * platforms) can be auto-filled. Costs ONE extra RAWG call per selection —
 * acceptable because selections are rare and deliberate. Returns null on failure.
 */
export async function getRawgDetails(id: string): Promise<VideoGameMetadata | null> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return null;

  const d = await fetchJson<RawgGameDetails>(
    `https://api.rawg.io/api/games/${id}?key=${apiKey}`
  );
  if (!d) return null;

  const developerObj = d.developers?.[0];
  const developer = developerObj?.name;
  const publisher = d.publishers?.[0]?.name;
  const year = yearFrom(d.released);
  const platforms = d.platforms
    ?.map((p) => p.platform?.name)
    .filter((name): name is string => !!name);

  return {
    ...(developer ? { developer } : {}),
    ...(developer && developerObj?.slug
      ? { developer_url: `https://rawg.io/developers/${developerObj.slug}` }
      : {}),
    ...(publisher ? { publisher } : {}),
    ...(year ? { release_year: year } : {}),
    ...(platforms && platforms.length ? { platforms } : {}),
  } satisfies VideoGameMetadata;
}
