import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileContent } from '@/components/features/profile/ProfileContent';

interface Props {
  params: Promise<{ nickname: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { nickname } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, created_at')
    .eq('nickname', nickname)
    .single();

  if (!profile) notFound();

  const isOwnProfile = user.id === profile.id;

  const { data: memberships } = await supabase
    .from('group_members')
    .select('role, groups(id, name, description, visibility, created_at)')
    .eq('user_id', profile.id);

  // Item counts per group the user belongs to
  const groupIds = (memberships ?? []).map((m) => (m.groups as unknown as { id: string })?.id).filter(Boolean);
  const { data: itemCountRows } = groupIds.length
    ? await supabase.from('media_items').select('group_id').in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string }> };

  const itemCountMap = new Map<string, number>();
  for (const row of itemCountRows ?? []) {
    itemCountMap.set(row.group_id, (itemCountMap.get(row.group_id) ?? 0) + 1);
  }

  // Consumption count for this user
  const { count: consumedCount } = await supabase
    .from('consumption_records')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  type GroupEntry = {
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    created_at: string;
    role: string;
    itemCount: number;
  };

  const allGroups: GroupEntry[] = (memberships ?? [])
    .map((m) => {
      if (!m.groups) return null;
      const g = m.groups as unknown as { id: string; name: string; description: string | null; visibility: string; created_at: string };
      return {
        ...g,
        role: m.role as string,
        itemCount: itemCountMap.get(g.id) ?? 0,
      };
    })
    .filter((g): g is GroupEntry => !!g);

  const visibleGroups = allGroups.filter(
    (g) => isOwnProfile || g.visibility === 'public'
  );

  const ownedCount = allGroups.filter((g) => g.role === 'owner').length;

  return (
    <ProfileContent
      profile={profile}
      isOwnProfile={isOwnProfile}
      visibleGroups={visibleGroups}
      ownedCount={ownedCount}
      consumedCount={consumedCount ?? 0}
    />
  );
}
