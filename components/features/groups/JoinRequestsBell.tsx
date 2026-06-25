'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { Bell, Check, X, PartyPopper } from 'lucide-react';
import type { PendingJoinRequest, AcceptedJoinRequest } from '@/types';

interface Props {
  requests: PendingJoinRequest[];
  accepted?: AcceptedJoinRequest[];
}

/**
 * Notification bell. Shows two kinds of notification:
 *  - pending access requests for groups the current user owns (with inline
 *    approve / decline), and
 *  - groups the current user was recently *accepted* into, as a requester.
 */
const DISMISSED_ACCEPTED_KEY = 'fa:dismissed-accepted';

function readDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_ACCEPTED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function JoinRequestsBell({ requests, accepted = [] }: Props) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Accepted notifications the user has already clicked. Persisted in
  // localStorage so they stay gone across reloads without any DB bookkeeping —
  // the 14-day window in Header.tsx still expires anything left untouched.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const validIds = new Set(accepted.map((a) => a.id));
    // Load, then prune ids that have aged out of the window so the list stays small.
    const stored = readDismissed().filter((id) => validIds.has(id));
    setDismissed(new Set(stored));
    try {
      window.localStorage.setItem(DISMISSED_ACCEPTED_KEY, JSON.stringify(stored));
    } catch {
      // Storage unavailable — dismissal just won't persist this session.
    }
  }, [accepted]);

  function dismissAccepted(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        window.localStorage.setItem(DISMISSED_ACCEPTED_KEY, JSON.stringify([...next]));
      } catch {
        // Ignore — non-persistent dismissal is still better than nothing.
      }
      return next;
    });
  }

  const visibleAccepted = useMemo(
    () => accepted.filter((a) => !dismissed.has(a.id)),
    [accepted, dismissed],
  );

  const totalCount = requests.length + visibleAccepted.length;

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
          aria-label={`Notifications${totalCount > 0 ? ` (${totalCount} new)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 inline-flex items-center justify-center font-mono text-[9px] leading-none text-stone-950"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {totalCount === 0 ? (
          <>
            <DropdownMenuLabel>
              <span className="text-stone-400">Notifications</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2 py-4 text-center text-stone-600 text-xs font-mono">
              Nothing new
            </p>
          </>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {visibleAccepted.length > 0 && (
              <>
                <DropdownMenuLabel>
                  <span className="text-stone-400">Accepted</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visibleAccepted.map((item) => (
                  <Link
                    key={item.id}
                    href={`/groups/${item.group_id}`}
                    onClick={() => dismissAccepted(item.id)}
                    className="flex items-start gap-2 px-2 py-2.5 border-b border-stone-800/30 last:border-b-0 hover:bg-stone-800/30 transition-colors"
                  >
                    <PartyPopper
                      className="h-3.5 w-3.5 mt-0.5 shrink-0"
                      style={{ color: 'var(--color-accent)' }}
                    />
                    <p className="min-w-0 text-stone-300 text-[11px] font-light leading-snug">
                      <span className="font-mono text-stone-200">{item.approver_nickname}</span>
                      {' accepted you — you’re now part of '}
                      <span className="font-mono text-stone-200">{item.group_name}</span>
                    </p>
                  </Link>
                ))}
              </>
            )}

            {requests.length > 0 && (
              <>
                <DropdownMenuLabel>
                  <span className="text-stone-400">Access requests</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
              </>
            )}
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
