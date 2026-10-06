'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AuthResponse } from '@/types';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { clearSession, getUserSnapshot, saveSession, subscribe } from '@/lib/session';

interface AuthContextType {
  user: AuthResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** True until the client has read the stored session (always true during SSR/hydration). */
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const noopSubscribe = () => () => {};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The session is external state (localStorage), read without effects. The
  // server snapshot is null/false, so hydration matches the server HTML and the
  // client then re-renders with the stored session.
  const userJson = useSyncExternalStore(subscribe, getUserSnapshot, () => null);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const user = useMemo<AuthResponse | null>(() => (userJson ? JSON.parse(userJson) : null), [userJson]);

  const startSession = useCallback(
    (auth: AuthResponse, message: string) => {
      // Never show one user's cached data to the next.
      queryClient.clear();
      saveSession(auth);
      toast.success(message);
      router.push('/dashboard');
    },
    [queryClient, router],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { data } = await authApi.login({ email, password });
        startSession(data, 'Logged in successfully!');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Login failed'));
        throw error;
      }
    },
    [startSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const { data } = await authApi.register({ name, email, password });
        startSession(data, 'Registered successfully!');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Registration failed'));
        throw error;
      }
    },
    [startSession],
  );

  const logout = useCallback(() => {
    clearSession();
    queryClient.clear();
    toast.success('Logged out successfully');
    router.push('/login');
  }, [queryClient, router]);

  const value = useMemo(
    () => ({ user, login, register, logout, isLoading: !hydrated }),
    [user, login, register, logout, hydrated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
