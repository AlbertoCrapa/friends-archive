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
import { LogOut, User, Settings } from 'lucide-react';

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
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .single();
    nickname = profile?.nickname ?? null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-800/50 bg-stone-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-serif text-lg tracking-widest text-stone-100 uppercase hover:text-amber-500 transition-colors">
          The Friend Archive
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/discover">
            <Button variant="ghost" size="sm">Discover</Button>
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-3 w-3" />
                  {nickname ?? 'Account'}
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
