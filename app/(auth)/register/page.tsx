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
    <main className="min-h-screen flex items-center justify-center bg-stone-950 px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-stone-100">Create your archive</h1>
          <p className="text-stone-500 text-sm font-mono">Start tracking with friends</p>
        </div>
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
