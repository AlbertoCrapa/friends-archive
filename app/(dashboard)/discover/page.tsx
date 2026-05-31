import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JoinGroupSubmitButton } from '@/components/features/groups/JoinGroupSubmitButton';
import { Globe, Users } from 'lucide-react';

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // All public groups with member count and item count
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description, created_at, owner_id')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  // Fetch user's current memberships to show "joined" state
  const { data: myMemberships } = user
    ? await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
    : { data: [] };

  const joinedSet = new Set((myMemberships ?? []).map((m) => m.group_id));
  const groupIds = (groups ?? []).map((group) => group.id);
  const { data: memberRows } = groupIds.length
    ? await supabase.from('group_members').select('group_id').in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string }> };

  const memberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
  }

  async function joinGroup(groupId: string) {
    'use server';
    if (!user) return;
    const supabase2 = await createClient();
    await supabase2.from('group_members').upsert({
      group_id: groupId,
      user_id: user.id,
      role: 'member',
    }, {
      onConflict: 'group_id,user_id',
    });
    revalidatePath('/discover');
    revalidatePath(`/groups/${groupId}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-stone-100">Discover</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">
          Browse public archives from other members.
        </p>
      </div>

      {!groups || groups.length === 0 ? (
        <div className="border border-stone-800/50 py-20 text-center">
          <p className="font-serif text-xl text-stone-600">No public groups yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const isMember = joinedSet.has(group.id);
            return (
              <div key={group.id} className="border border-stone-800/50 p-5 space-y-3 transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)] hover:border-amber-800/50 hover:bg-stone-900/30 hover:shadow-[var(--shadow-2)] hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/groups/${group.id}`} className="group min-w-0 cursor-pointer">
                    <h2 className="font-serif text-lg text-stone-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                      {group.name}
                    </h2>
                  </Link>
                  <Badge variant="public" className="shrink-0 gap-1">
                    <Globe className="h-2.5 w-2.5" /> Public
                  </Badge>
                </div>
                {group.description && (
                  <p className="text-stone-500 text-sm font-light line-clamp-2">{group.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-stone-600">
                    <Users className="h-3 w-3 inline mr-1" />
                    {memberCounts.get(group.id) ?? 0} member{(memberCounts.get(group.id) ?? 0) === 1 ? '' : 's'}
                  </span>
                  {user && !isMember && (
                    <form action={joinGroup.bind(null, group.id)}>
                      <JoinGroupSubmitButton />
                    </form>
                  )}
                  {isMember && (
                    <Link href={`/groups/${group.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
