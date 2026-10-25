'use client';

import { useRef } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { clearOffline, pendingOps } from '@/lib/offline';

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
          // The offline copy and the outbox belong to this account, not to
          // the device: the next person to sign in gets neither.
          void pendingOps().then(async (ops) => {
            if (
              ops.length > 0 &&
              !window.confirm(
                `${ops.length} change${ops.length === 1 ? '' : 's'} made offline have not synced yet. Signing out deletes them. Sign out anyway?`,
              )
            ) {
              return;
            }
            await clearOffline().catch(() => null);
            formRef.current?.requestSubmit();
          });
        }}
        className="flex items-center gap-2 w-full text-red-400 focus:text-red-300 cursor-pointer"
      >
        <LogOut className="h-3 w-3" />
        Sign out
      </DropdownMenuItem>
    </form>
  );
}
