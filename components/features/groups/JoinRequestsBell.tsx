'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { approveJoinRequest, declineJoinRequest } from '@/app/actions/join-requests';
import { Bell, Check, X } from 'lucide-react';
import type { PendingJoinRequest } from '@/types';

interface Props {
  requests: PendingJoinRequest[];
}

/**
 * Owner notification bell: lists pending access requests for groups the
 * current user owns, with inline approve / decline.
 */
export function JoinRequestsBell({ requests }: Props) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resolve(action: 'approve' | 'decline', request: PendingJoinRequest) {
    setBusyId(request.id);
    setError(null);
    startTransition(async () => {
      const fn = action === 'approve' ? approveJoinRequest : declineJoinRequest;
      const { error: actionError } = await fn(request.id, request.group_id);
      if (actionError) setError(actionError);
      setBusyId(null);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11"
          aria-label={`Access requests${requests.length > 0 ? ` (${requests.length} pending)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {requests.length > 0 && (
            <span
              className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 inline-flex items-center justify-center font-mono text-[9px] leading-none text-stone-950"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {requests.length > 9 ? '9+' : requests.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <span className="text-stone-400">Access requests</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {requests.length === 0 ? (
          <p className="px-2 py-4 text-center text-stone-600 text-xs font-mono">
            No pending requests
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-2 px-2 py-2.5 border-b border-stone-800/30 last:border-b-0"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-stone-200 text-xs font-mono truncate">
                    {request.requester_nickname}
                  </p>
                  <Link
                    href={`/groups/${request.group_id}`}
                    className="block text-stone-500 text-[11px] font-light truncate hover:text-stone-300 transition-colors"
                  >
                    {request.group_name}
                  </Link>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {busyId === request.id && isPending ? (
                    <Spinner className="h-3.5 w-3.5 mx-2" />
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-stone-500 hover:text-emerald-400"
                        onClick={() => resolve('approve', request)}
                        disabled={isPending}
                        aria-label={`Approve ${request.requester_nickname}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-stone-500 hover:text-red-400"
                        onClick={() => resolve('decline', request)}
                        disabled={isPending}
                        aria-label={`Decline ${request.requester_nickname}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="px-2 py-2 text-[11px] font-mono" style={{ color: 'oklch(0.6 0.18 15)' }}>
            {error}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
