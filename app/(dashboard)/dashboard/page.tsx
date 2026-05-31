import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Lock, Globe } from 'lucide-react';
import type { Group, GroupRole } from '@/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all groups the user belongs to with member + item counts
  const { data: memberships } = await supabase
    .from('group_members')
    .select(`
      role,
      groups (
        id,
        name,
        description,
        visibility,
        created_at
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { referencedTable: 'groups', ascending: false });

  // Fetch the user's subscription plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user!.id)
    .single();

  type GroupRow = Group & { role: GroupRole };
  const groups: GroupRow[] = (memberships ?? []).map((m) => ({
    ...(m.groups as unknown as Group),
    role: m.role as GroupRole,
  }));

  const ownedCount = groups.filter((g) => g.role === 'owner').length;
  const maxOwned = subscription?.plan === 'premium' ? 10 : subscription?.plan === 'enterprise' ? Infinity : 2;
  const atLimit = ownedCount >= maxOwned;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-stone-100">My Archives</h1>
          <p className="text-stone-500 text-sm font-mono mt-1">
            {groups.length} group{groups.length !== 1 ? 's' : ''} · {ownedCount} owned
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit ? (
            <Link href="/pricing">
              <Button variant="outline" size="sm">Upgrade to create more</Button>
            </Link>
          ) : (
            <Link href="/groups/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New group
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Groups grid */}
      {groups.length === 0 ? (
        <div className="border border-stone-800/50 py-20 text-center space-y-4">
          <p className="font-serif text-xl text-stone-500">No groups yet</p>
          <p className="text-stone-600 text-sm font-mono">Create one or discover public archives to join.</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/groups/new"><Button size="sm">Create a group</Button></Link>
            <Link href="/discover"><Button variant="outline" size="sm">Discover</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="group cursor-pointer">
              <div className="border border-stone-800/50 p-5 hover:border-amber-800/50 hover:bg-stone-900/30 hover:shadow-[var(--shadow-2)] hover:-translate-y-0.5 transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-lg text-stone-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                    {group.name}
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    {group.visibility === 'public' ? (
                      <Badge variant="public" className="gap-1">
                        <Globe className="h-2.5 w-2.5" /> Public
                      </Badge>
                    ) : (
                      <Badge variant="private" className="gap-1">
                        <Lock className="h-2.5 w-2.5" /> Private
                      </Badge>
                    )}
                  </div>
                </div>
                {group.description && (
                  <p className="text-stone-500 text-sm font-light line-clamp-2">{group.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs font-mono text-stone-600">
                  <span>{group.role === 'owner' ? 'Owner' : 'Member'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
