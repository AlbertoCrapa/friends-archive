import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { JoinRequestsBell } from '@/components/features/groups/JoinRequestsBell';
import { PrimaryNavButton } from '@/components/layout/PrimaryNavButton';
import { SignOutMenuItem } from '@/components/layout/SignOutMenuItem';
import { User } from 'lucide-react';
import type { PendingJoinRequest, AcceptedJoinRequest } from '@/types';

// How long an "accepted" notification stays in the bell after the owner
// approves. Derived from resolved_at — there is no read/unread bookkeeping
// (see DATA_MODEL § 6.6), so a time window keeps the list from growing forever.
const ACCEPTED_NOTIFICATION_WINDOW_DAYS = 14;

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let nickname: string | null = null;
  let pendingRequests: PendingJoinRequest[] = [];
  let acceptedRequests: AcceptedJoinRequest[] = [];
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .single();
    nickname = profile?.nickname ?? null;

    // Owner notifications: pending access requests for groups this user owns
    const { data: requestRows } = await supabase
      .from('group_join_requests')
      .select('id, group_id, created_at, groups!inner(name, owner_id), profiles!group_join_requests_user_id_fkey(nickname)')
      .eq('status', 'pending')
      .eq('groups.owner_id', user.id)
      .order('created_at', { ascending: false });

    pendingRequests = (requestRows ?? []).map((row) => {
      const groupRel = row.groups as unknown as { name: string };
      const profileRel = row.profiles as unknown as { nickname: string } | null;
      return {
        id: row.id,
        group_id: row.group_id,
        group_name: groupRel?.name ?? 'Unknown group',
        requester_nickname: profileRel?.nickname ?? 'Unknown user',
        created_at: row.created_at,
      };
    });

    // Requester notifications: requests of this user that an owner recently
    // approved — "X accepted you, you're now part of the group".
    const acceptedSince = new Date(
      Date.now() - ACCEPTED_NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: acceptedRows } = await supabase
      .from('group_join_requests')
      .select('id, group_id, resolved_at, groups!inner(name), profiles!group_join_requests_resolved_by_fkey(nickname)')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .gte('resolved_at', acceptedSince)
      .order('resolved_at', { ascending: false });

    acceptedRequests = (acceptedRows ?? []).map((row) => {
      const groupRel = row.groups as unknown as { name: string };
      const approverRel = row.profiles as unknown as { nickname: string } | null;
      return {
        id: row.id,
        group_id: row.group_id,
        group_name: groupRel?.name ?? 'Unknown group',
        approver_nickname: approverRel?.nickname ?? 'The owner',
        resolved_at: row.resolved_at as string,
      };
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-800/50 bg-stone-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-serif text-base sm:text-lg tracking-[0.18em] text-stone-100 uppercase hover:text-amber-500 transition-colors whitespace-nowrap leading-none">
          The Friend Archive
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <PrimaryNavButton />

          {user && <JoinRequestsBell requests={pendingRequests} accepted={acceptedRequests} />}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 min-h-11">
                  <User className="h-3 w-3" />
                  <span className="hidden sm:inline">{nickname ?? 'Account'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <span className="text-stone-400">{nickname}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {nickname && (
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${nickname}`} className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <SignOutMenuItem action={signOut} />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
