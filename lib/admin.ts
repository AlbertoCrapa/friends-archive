// ============================================
// Who counts as the operator.
//
// This app has group owners, but no global admin — and it shouldn't grow one
// in the database for a single ops page. Membership here is an env var: the
// operator is whoever the deployment says it is, which is exactly the set of
// people who can already read the service role key.
// ============================================

import { createClient } from '@/lib/supabase/server';

/** Lower-cased ADMIN_EMAILS, comma-separated. Empty means nobody. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The signed-in user's email if they are an operator, otherwise null.
 *
 * Fails closed in every direction: no session, no ADMIN_EMAILS set, email not
 * on the list — all null. Callers should notFound() rather than redirect, so
 * an ordinary member who guesses the URL learns only that there is no page
 * there.
 */
export async function requireAdmin(): Promise<string | null> {
  const allowed = adminEmails();
  if (allowed.length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  if (!email || !allowed.includes(email)) return null;
  return email;
}

/** True when nobody is configured — the admin page uses this to say so. */
export function adminListIsEmpty(): boolean {
  return adminEmails().length === 0;
}
