import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/features/auth/LoginForm';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-950 px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-stone-100">Welcome back</h1>
          <p className="text-stone-500 text-sm font-mono">Sign in to your archive</p>
        </div>
        <LoginForm />
        <p className="text-center text-stone-600 text-sm font-mono">
          No account?{' '}
          <a href="/register" className="text-amber-500 hover:text-amber-400 transition-colors">
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}
