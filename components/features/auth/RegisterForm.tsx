'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormBanner } from '@/components/ui/form-banner';

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (nickname.trim().length < 2) {
      setError('Nickname must be at least 2 characters.');
      return;
    }

    setLoading(true);

    // Pre-check nickname availability before creating the auth user
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', nickname.trim())
      .maybeSingle();

    if (existing) {
      setError('That nickname is already taken. Please choose another.');
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname: nickname.trim() },
      },
    });

    if (authError) {
      setError(mapRegisterError(authError));
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="howthedisappear"
          autoComplete="username"
          required
        />
        <p className="text-xs text-stone-600 font-mono">
          Your unique handle visible to other members.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
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
            Creating account...
          </span>
        ) : (
          'Create account'
        )}
      </Button>
    </form>
  );
}

function mapRegisterError(error: { message: string; status?: number }): string {
  const normalized = error.message.toLowerCase();

  // Blocked by the signup email allowlist (the "Before User Created" hook
  // returns http_code 403 with an "invite list" message). Check both the
  // status and the text so a wrapped message still resolves to this case.
  if (
    error.status === 403 ||
    normalized.includes('invite list') ||
    normalized.includes('not on the') ||
    normalized.includes('not authorized')
  ) {
    return 'This email is not authorized to register. Please ask an admin to add you to the invite list, then try again.';
  }
  if (normalized.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (normalized.includes('password')) {
    return 'Please choose a stronger password and try again.';
  }
  return 'We could not create your account right now. Please try again.';
}
