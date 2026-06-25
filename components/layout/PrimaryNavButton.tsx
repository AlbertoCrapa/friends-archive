'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Compass, LayoutDashboard } from 'lucide-react';

/**
 * Context-aware nav button. On the Discover page it points back to the
 * personal Dashboard (linking to Discover there would be a no-op); everywhere
 * else it points to Discover.
 */
export function PrimaryNavButton() {
  const pathname = usePathname();
  const onDiscover = pathname === '/discover' || pathname.startsWith('/discover/');

  const target = onDiscover
    ? { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }
    : { href: '/discover', label: 'Discover', Icon: Compass };

  return (
    <>
      <Link href={target.href} className="hidden sm:inline-flex">
        <Button variant="ghost" size="sm">{target.label}</Button>
      </Link>
      <Link href={target.href} className="sm:hidden inline-flex">
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={target.label}>
          <target.Icon className="h-4 w-4" />
        </Button>
      </Link>
    </>
  );
}
