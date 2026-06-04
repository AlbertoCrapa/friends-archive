import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { PageTransition } from '@/components/layout/PageTransition';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <Header />
      <PageTransition>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </PageTransition>
    </div>
  );
}
