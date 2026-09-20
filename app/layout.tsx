import type { Metadata } from 'next';
import { PROVIDER_IMAGE_HOSTS } from '@/lib/utils';
import { ToastProvider } from '@/components/ui/toast';
import '@/components/micro/micro.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Friend Archive',
  description: 'Track together. Remember always.',
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
