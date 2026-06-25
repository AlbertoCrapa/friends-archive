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
import { Compass, LogOut, User, Settings } from 'lucide-react';
import type { PendingJoinRequest } from '@/types';

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
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-800/50 bg-stone-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-serif text-base sm:text-lg tracking-[0.18em] text-stone-100 uppercase hover:text-amber-500 transition-colors whitespace-nowrap leading-none">
          The Friend Archive
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/discover" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">Discover</Button>
          </Link>
          <Link href="/discover" className="sm:hidden inline-flex">
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Discover">
              <Compass className="h-4 w-4" />
            </Button>
          </Link>

          {user && <JoinRequestsBell requests={pendingRequests} />}

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
                <DropdownMenuItem asChild>
                  <Link href="/pricing" className="flex items-center gap-2">
                    <Settings className="h-3 w-3" />
                    Subscription
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={signOut}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="flex items-center gap-2 w-full text-red-400 focus:text-red-300">
                      <LogOut className="h-3 w-3" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
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
