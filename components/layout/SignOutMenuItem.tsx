'use client';

import { useRef } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';

/**
 * Sign-out entry for the account dropdown. A plain submit button inside a Radix
 * DropdownMenuItem never fires — Radix unmounts the menu on select before the
 * form submits. So we drive the form submit explicitly from `onSelect` instead.
 */
export function SignOutMenuItem({ action }: { action: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }}
        className="flex items-center gap-2 w-full text-red-400 focus:text-red-300 cursor-pointer"
      >
        <LogOut className="h-3 w-3" />
        Sign out
      </DropdownMenuItem>
    </form>
  );
}
