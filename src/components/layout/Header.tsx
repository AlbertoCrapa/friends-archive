import { LogOut, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className="h-16 border-b border-stone-800 bg-stone-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full max-w-[1800px] mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-amber-600/50 flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-950">
            <Archive className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold text-stone-100 leading-tight">
              The Archive
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500">
              Cultural Repository
            </p>
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex justify-center">
          {children}
        </div>

        {/* User info */}
        {session && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-stone-300 font-medium">
                {session.nickname}
              </p>
              <p className="text-[10px] font-mono text-stone-600 uppercase tracking-wider">
                Curator
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-stone-500 hover:text-stone-300"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
