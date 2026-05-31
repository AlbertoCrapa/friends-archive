'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormBanner } from '@/components/ui/form-banner';

/**
 * This page is the landing point after a user clicks the password-reset link
 * in their email. Supabase redirects here with a session established via the
 * URL fragment. We listen for the PASSWORD_RECOVERY event and then let the
 * user set a new password.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Supabase fires PASSWORD_RECOVERY when the reset link is followed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError('We could not update your password right now. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-950 px-6">
        <div className="text-center space-y-3">
          <p className="font-mono text-stone-400 text-sm inline-flex items-center gap-2">
            <Spinner />
            Verifying reset link...
          </p>
          <p className="font-mono text-stone-700 text-xs">
            If this takes more than a few seconds, your link may have expired.{' '}
            <a href="/reset-password" className="text-amber-500 hover:text-amber-400">
              Request a new one.
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-950 px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-stone-100">Set new password</h1>
          <p className="text-stone-500 text-sm font-mono">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <FormBanner message={error} variant="error" />}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Updating...
              </span>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
