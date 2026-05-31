import type { Metadata } from 'next';
import './globals.css';
import { PageTransition } from '@/components/layout/PageTransition';

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
      <body>
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
