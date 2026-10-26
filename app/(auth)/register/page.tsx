import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm } from '@/components/features/auth/RegisterForm';

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-stone-100">Create your archive</h1>
          <p className="text-stone-500 text-sm font-mono">Start tracking with friends</p>
        </div>
        <aside className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-stone-400 space-y-3">
          <p>
            The code is{' '}
            <a
              href="https://github.com/AlbertoCrapa/friends-archive"
              target="_blank"
              rel="noreferrer"
              className="text-stone-200 underline underline-offset-2 hover:text-amber-400"
            >
              open source
            </a>
            , but for now this hosted version is invite-only. To get access, email a request.
          </p>
          <a
            href="mailto:hello@albyeah.com?subject=Friend%20Archive%20access%20request"
            className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1.5 font-mono text-xs text-stone-950 hover:bg-amber-400 transition-colors"
          >
            Request access · hello@albyeah.com
          </a>
        </aside>
        <RegisterForm />
        <p className="text-center text-stone-600 text-sm font-mono">
          Already a member?{' '}
          <a href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
