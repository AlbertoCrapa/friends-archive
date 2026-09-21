import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { getUsageReport } from '@/lib/usage/query';
import { ApiUsageDashboard } from '@/components/features/admin/ApiUsageDashboard';

export const metadata = { title: 'API usage' };

// Always fresh: a meter you have to guess the age of is not a meter. The
// underlying reads are aggregated views, so this is a couple of cheap queries.
export const dynamic = 'force-dynamic';

/**
 * /admin — the operator's page.
 *
 * Not linked from anywhere in the app, and not redirect-protected: a member
 * who guesses the URL gets the 404 they would have got if the route didn't
 * exist. The gate is ADMIN_EMAILS (lib/admin.ts); the dashboard layout above
 * has already established that somebody is signed in.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const report = await getUsageReport();
  return <ApiUsageDashboard report={report} />;
}
