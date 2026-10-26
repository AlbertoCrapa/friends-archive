import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { PageTransition } from '@/components/layout/PageTransition';
import { InstalledApp } from '@/components/features/groups/OfflineApp';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen">
      <InstalledApp renderedAt={Date.now()} />
      <Header />
      <PageTransition>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </PageTransition>
    </div>
  );
}
