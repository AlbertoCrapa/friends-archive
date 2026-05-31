import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-950 text-center px-6 space-y-6">
      <span className="font-mono text-6xl text-stone-800">404</span>
      <h1 className="font-serif text-2xl text-stone-300">Page not found</h1>
      <p className="text-stone-600 text-sm font-mono max-w-xs">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/dashboard">
        <Button variant="outline" size="sm">Go to dashboard</Button>
      </Link>
    </main>
  );
}
