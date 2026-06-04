import { createClient } from '@/lib/supabase/server';
import { LandingPageContent } from '@/components/features/landing/LandingPageContent';

export default async function LandingPage() {
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

  return <LandingPageContent isSignedIn={!!user} nickname={nickname} />;
}
