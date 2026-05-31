import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GroupSettings } from '@/components/features/groups/GroupSettings';
import type { Member } from '@/components/features/groups/GroupSettings';

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

  // Fetch members
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, role, joined_at, profiles(nickname)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-stone-100">Group settings</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">{group.name}</p>
      </div>
      <GroupSettings group={group} members={(members ?? []) as unknown as Member[]} currentUserId={user.id} />
    </div>
  );
}
