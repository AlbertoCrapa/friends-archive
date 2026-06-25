import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { GroupSettings } from '@/components/features/groups/GroupSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { JoinRequestRow, Member } from '@/components/features/groups/GroupSettings';

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupSettingsPage({ params }: Props) {
  const { groupId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, description, visibility, owner_id')
    .eq('id', groupId)
    .single();

  if (!group) notFound();
  if (group.owner_id !== user.id) redirect(`/groups/${groupId}`);

  // Fetch members + pending access requests
  const [{ data: members }, { data: joinRequests }] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id, role, joined_at, profiles(nickname)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('group_join_requests')
      .select('id, user_id, created_at, profiles!group_join_requests_user_id_fkey(nickname)')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={`/groups/${groupId}`} className="inline-flex mb-4">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to group
          </Button>
        </Link>
        <h1 className="font-serif text-3xl text-stone-100">Group settings</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">{group.name}</p>
      </div>
      <GroupSettings
        group={group}
        members={(members ?? []) as unknown as Member[]}
        joinRequests={(joinRequests ?? []) as unknown as JoinRequestRow[]}
        currentUserId={user.id}
      />
    </div>
  );
}
