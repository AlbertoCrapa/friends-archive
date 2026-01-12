import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSession } from '@/types';

interface AuthState {
  session: UserSession | null;
  setSession: (session: UserSession | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),
    }),
    {
      name: 'archive-auth',
    }
  )
);
