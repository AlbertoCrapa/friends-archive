import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/api';

const isDev = import.meta.env.DEV;

export function LoginForm() {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // In dev mode, accept any password
    if (isDev) {
      setSession({
        nickname: nickname || 'Dev User',
        isAuthenticated: true,
      });
      setIsLoading(false);
      return;
    }

    const result = await authApi.login(nickname, password);

    if (result.success && result.data) {
      setSession({
        nickname: result.data.nickname,
        isAuthenticated: true,
      });
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 p-4">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-amber-900/10 to-transparent rotate-12" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-stone-800/20 to-transparent -rotate-12" />
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main card */}
        <div className="border border-stone-800 bg-stone-900/80 backdrop-blur-sm p-8 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-serif text-4xl font-bold text-stone-100 tracking-tight mb-2">
              The Archive
            </h1>
            <p className="text-stone-500 font-mono text-xs uppercase tracking-[0.3em]">
              Enter the vault
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="username"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Shared password"
                required
                autoComplete="current-password"
                className="h-12"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm font-mono bg-red-950/30 border border-red-900/50 p-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-base"
            >
              {isLoading ? 'Entering...' : 'Enter Archive'}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-stone-800 text-center">
            <p className="text-stone-600 text-xs font-mono">
              A shared space for cultural consumption
            </p>
          </div>
        </div>

        {/* Decorative corners */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-600/50" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-600/50" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-600/50" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-600/50" />
      </div>
    </div>
  );
}
