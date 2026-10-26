import type { Metadata } from 'next';
import { PROVIDER_IMAGE_HOSTS } from '@/lib/utils';
import { SPLASH_SCREENS } from '@/lib/splash.mjs';
import { ToastProvider } from '@/components/ui/toast';
import { ArchiveImportProvider } from '@/components/features/groups/ArchiveImport';
import '@/components/micro/micro.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Friend Archive',
  description: 'Track together. Remember always.',
  // iOS ignores the manifest for these: they make "Add to Home Screen" open
  // full-screen with our icon and name.
  // (The home-screen icon itself is app/apple-icon.png.)
  // startupImage is the launch splash (drawn by scripts/render-icons.mjs);
  // without it iOS opens on a blank white screen.
  appleWebApp: {
    capable: true,
    title: 'Archive',
    statusBarStyle: 'black',
    startupImage: SPLASH_SCREENS.map(({ file, media }) => ({ url: file, media })),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Item artwork is served straight from the providers' own CDNs (see
            DATA_MODEL § 6.10). Warming the TLS handshake here means the first
            poster of a cold visit starts downloading immediately instead of
            paying for a fresh connection; on every later visit the images come
            from the browser's disk cache and these cost nothing. */}
        {PROVIDER_IMAGE_HOSTS.map((host) => (
          <link key={host} rel="preconnect" href={`https://${host}`} crossOrigin="anonymous" />
        ))}
      </head>
      {/* The toast dock lives at the root, above every route: a notification
          raised by a row that is already gone — or by a page you have since
          navigated away from — has to outlive whatever raised it, and a
          deferred delete has to keep its undo window while it does. */}
      <body>
        {/* Holds the page's width still when a menu or a dialog locks
            scrolling — see the component for why CSS alone is not taken on
            trust here. */}
        <ToastProvider>
          {/* Inside the toast dock: an archive import keeps running across
              navigations and reports back through a toast when it ends. */}
          <ArchiveImportProvider>{children}</ArchiveImportProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
