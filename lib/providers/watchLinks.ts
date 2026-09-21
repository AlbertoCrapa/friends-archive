// ============================================================================
// Per-service search links.
//
// TMDB tells us WHO has a title. It does not tell us WHERE the title lives
// inside that service — nobody gives that away free, and JustWatch's own terms
// ask that their page be the destination for their data (see § 6.11.1).
//
// So this file does the only honest thing left: it sends you to the service's
// OWN SEARCH, with the title already typed. Not the film's page — one keypress
// away from it, inside the app you were going to open anyway.
//
// EVERY URL BELOW WAS CHECKED BY HAND against the live site. A service whose
// search URL we could not verify is deliberately absent: the caller falls back
// to the JustWatch page for it, which always works. A wrong link here is worse
// than no link, because it looks like it worked.
// ============================================================================

/**
 * `provider` matches TMDB's `provider_name` — lowercased, and by PREFIX, because
 * TMDB ships a family of names per service ("Netflix", "Netflix basic with
 * Ads"; "Apple TV", "Apple TV Store"). `query` builds the URL from the title.
 *
 * Order matters: the first prefix that matches wins, so the narrow entries
 * (`amazon channel`) sit above the broad ones.
 */
interface ServiceSearch {
  prefixes: string[];
  query: (encoded: string) => string;
}

const SERVICES: ServiceSearch[] = [
  // Every "… Amazon Channel" is an add-on you watch INSIDE Prime Video, so the
  // right door is Prime's search — checked before the Amazon entries below,
  // and before anything else, since the prefix is at the END of those names.
  {
    prefixes: ['amazon prime video', 'prime video', 'amazon video'],
    query: (q) => `https://www.primevideo.com/search?phrase=${q}`,
  },
  { prefixes: ['netflix'], query: (q) => `https://www.netflix.com/search?q=${q}` },
  { prefixes: ['apple tv'], query: (q) => `https://tv.apple.com/it/search?term=${q}` },
  {
    prefixes: ['google play movies'],
    query: (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
  },
  { prefixes: ['rakuten tv'], query: (q) => `https://www.rakuten.tv/it/search?q=${q}` },
  {
    prefixes: ['paramount plus', 'paramount+'],
    query: (q) => `https://www.paramountplus.com/it/search/?q=${q}`,
  },
  { prefixes: ['rai play', 'raiplay'], query: (q) => `https://www.raiplay.it/ricerca.html?q=${q}` },
  { prefixes: ['youtube'], query: (q) => `https://www.youtube.com/results?search_query=${q}` },
  { prefixes: ['chili'], query: (q) => `https://it.chili.com/search?q=${q}` },
  { prefixes: ['mubi'], query: (q) => `https://mubi.com/it/search/films?query=${q}` },
  { prefixes: ['plex'], query: (q) => `https://watch.plex.tv/search?query=${q}` },
  { prefixes: ['crunchyroll'], query: (q) => `https://www.crunchyroll.com/search?q=${q}` },
];

/**
 * The service's own search page for this title, or undefined when we have no
 * verified URL for it — Disney+, NOW, Sky Go, Timvision, Mediaset Infinity and
 * HBO Max all either 404 an unauthenticated search or throw the query away on
 * the way to their homepage, and a chip that lands you nowhere is a chip that
 * lied to you.
 *
 * The suffix match on "amazon channel" is checked first: those names END with
 * it ("HBO Max Amazon Channel"), and they are watched inside Prime.
 */
export function serviceSearchUrl(providerName: string, title: string): string | undefined {
  const name = providerName.trim().toLowerCase();
  const query = encodeURIComponent(title.trim());
  if (!name || !query) return undefined;

  if (name.endsWith('amazon channel')) {
    return `https://www.primevideo.com/search?phrase=${query}`;
  }
  for (const service of SERVICES) {
    if (service.prefixes.some((prefix) => name.startsWith(prefix))) return service.query(query);
  }
  return undefined;
}
