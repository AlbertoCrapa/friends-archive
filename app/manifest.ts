import type { MetadataRoute } from 'next';

// ============================================
// One installable app for the whole archive — not one per group. It opens on
// the dashboard: signed in, that is home; signed out, the dashboard layout
// sends you to /login. Next links this into every page's <head> by itself.
// ============================================

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'The Friend Archive',
    short_name: 'Archive',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    // --color-background, so Android's launch splash hands over to the first
    // page without a change of shade.
    background_color: '#0b0b0f',
    theme_color: '#0b0b0f',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
