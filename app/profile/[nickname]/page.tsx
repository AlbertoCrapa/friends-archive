import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Lock } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface Props {
  params: Promise<{ nickname: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { nickname } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Find the profile by nickname
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, created_at')
    .eq('nickname', nickname)
    .single();

  if (!profile) notFound();

  const isOwnProfile = user.id === profile.id;

  // Show all groups on your own profile, public groups on others' profiles.
  const { data: memberships } = await supabase
    .from('group_members')
    .select('role, groups(id, name, description, visibility, created_at)')
    .eq('user_id', profile.id);

  type GroupEntry = Record<string, unknown> & { role: string };
  const visibleGroups: GroupEntry[] = (memberships ?? [])
    .map((m) => {
      if (!m.groups) return null;
      return { ...(m.groups as unknown as Record<string, unknown>), role: m.role as string };
    })
    .filter((g): g is GroupEntry => !!g)
    .filter((g) => isOwnProfile || g.visibility === 'public');

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="inline-flex">
          <Button variant="ghost" size="sm" className="mb-3 gap-2">
            Back to dashboard
          </Button>
        </Link>
        <h1 className="font-serif text-3xl text-stone-100">{profile.nickname}</h1>
        <p className="text-stone-600 text-xs font-mono">
          Member since {formatDate(profile.created_at)}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-mono uppercase tracking-widest text-xs text-stone-500">
          {isOwnProfile ? 'Your archives' : 'Public archives'} ({visibleGroups.length})
        </h2>
        {visibleGroups.length === 0 ? (
          <p className="text-stone-700 text-sm font-mono">
            {isOwnProfile ? 'No groups yet.' : 'No public groups yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleGroups.map((g) => (
              <Link
                key={g.id as string}
                href={`/groups/${g.id}`}
                className="group block cursor-pointer border border-stone-800/50 p-4 hover:border-amber-800/50 hover:bg-stone-900/30 hover:shadow-[var(--shadow-2)] hover:-translate-y-0.5 transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)]"
              >
                <div className="flex items-center gap-3">
                  <span className="font-serif text-stone-100 group-hover:text-amber-400 transition-colors">
                    {g.name as string}
                  </span>
                  {(g.visibility as string) === 'public' ? (
                    <Badge variant="public" className="gap-1 shrink-0">
                      <Globe className="h-2.5 w-2.5" /> Public
                    </Badge>
                  ) : (
                    <Badge variant="private" className="gap-1 shrink-0">
                      <Lock className="h-2.5 w-2.5" /> Private
                    </Badge>
                  )}
                </div>
                {(g.description as string | null) && (
                  <p className="text-stone-600 text-xs font-light mt-1 line-clamp-1">
                    {g.description as string}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
