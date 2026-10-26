// The Friend Archive — offline copies for the installed app on this device.
// Registered once the app is installed or a member turns a group's offline
// mode on (lib/offline.ts).
//
// Opening a page (dashboard, a group): STALE WHILE REVALIDATE. The last copy is
// on screen at once — that is what makes the app open fast — while the live
// one is fetched behind it; the page then refreshes itself to the live data
// (InstalledApp in components/features/groups/OfflineApp.tsx).
// Data and in-app navigation: NETWORK FIRST. Online you always get the live
// archive, and every good answer is kept, so offline you get the last one.
// Build assets and posters: CACHE FIRST. A hashed chunk never changes, and a
// poster that is already on the device does not need fetching twice.
//
// Cache names must start with "fa-": signing out deletes everything that does.

const PAGES = 'fa-pages';
const STATIC = 'fa-static';
const DATA = 'fa-data';
const IMAGES = 'fa-images';
// Same list as PROVIDER_IMAGE_HOSTS in lib/utils.ts.
const IMAGE_HOSTS = ['image.tmdb.org', 'covers.openlibrary.org', 'media.rawg.io'];
// Posters come back opaque (cross-origin, no CORS) and Chrome bills each one
// at several MB of quota no matter its size, so the poster cache is capped.
const IMAGE_LIMIT = 300;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.searchParams.has('__probe')) return;

  if (IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, IMAGES, IMAGE_LIMIT));
  } else if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request, STATIC));
    } else if (url.pathname === '/dashboard' || url.pathname.startsWith('/groups/')) {
      event.respondWith(
        request.mode === 'navigate' ? staleWhileRevalidate(event, PAGES) : networkFirst(request, PAGES),
      );
    } else if (url.pathname.startsWith('/icon')) {
      event.respondWith(networkFirst(request, PAGES));
    } else if (url.pathname === '/api/external-details' || url.pathname === '/api/item-story') {
      event.respondWith(networkFirst(request, DATA));
    }
  } else if (url.pathname.startsWith('/rest/v1/')) {
    // Supabase reads: comments, verdicts, statuses opened from an item sheet.
    event.respondWith(networkFirst(request, DATA));
  }
});

/**
 * A page is kept under its bare path: `?type=book&item=…` only changes what the
 * client shows, and an offline open with any of them should find the copy.
 * React Server Component fetches (`_rsc`) are a different body for the same
 * path, so they keep their full URL.
 */
function keyOf(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.searchParams.has('_rsc')) return request.url;
  return url.origin + url.pathname;
}

async function networkFirst(request, cacheName) {
  const key = keyOf(request);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      const cache = await caches.open(cacheName);
      await cache.put(key, response.clone());
    }
    return response;
  } catch (error) {
    const hit = await caches.match(key, { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
}

/**
 * The kept copy now, the network into the cache behind it. No copy yet (first
 * open on this device): plain network first.
 * ponytail: a copy from before a deploy can point at chunks the new deploy no
 * longer serves; the ones it already used are in fa-static, and the refresh
 * after load brings the new build. Add a build-id check if a stale open breaks.
 */
async function staleWhileRevalidate(event, cacheName) {
  const request = event.request;
  const hit = await caches.match(keyOf(request), { ignoreVary: true });
  if (!hit) return networkFirst(request, cacheName);
  event.waitUntil(
    fetch(request)
      .then(async (response) => {
        // A redirect (signed out → /login) is not a copy of this page.
        if (response.ok && !response.redirected) {
          await (await caches.open(cacheName)).put(keyOf(request), response);
        }
      })
      .catch(() => null),
  );
  return hit;
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    if (limit) {
      const keys = await cache.keys();
      // Oldest first: keys come back in insertion order.
      await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
    }
  }
  return response;
}
