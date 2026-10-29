'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import type { AuthResponse, User } from '@/types';
import { authApi, setSessionExpiredHandler } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

export interface RegisterArgs {
  name: string;
  email: string;
  password: string;
  /** Creating an organisation: the sign-up becomes its owner. */
  organizationName?: string;
  /** Joining an organisation through an invite link. */
  inviteToken?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterArgs) => Promise<void>;
  logout: () => Promise<void>;
  /** True until the first /auth/me answer arrives. */
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const meQueryKey = ['auth', 'me'] as const;

const toUser = ({ id, name, email, role, orgId, isOwner }: AuthResponse): User => ({ id, name, email, role, orgId, isOwner });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The session is the httpOnly cookie, which page scripts can't read, so
  // "who am I" is a server question. A 401 means signed out, not an error.
  const me = useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        return (await authApi.me()).data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Tokens used to live in localStorage; drop any left over from older builds.
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  // Refresh failed mid-session: forget everything; ProtectedRoute redirects.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] });
      queryClient.setQueryData(meQueryKey, null);
    });
  }, [queryClient]);

  const startSession = useCallback(
    (auth: AuthResponse, message: string) => {
      // Never show one user's cached data to the next.
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, toUser(auth));
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
    async (input: RegisterArgs) => {
      try {
        const { data } = await authApi.register(input);
        startSession(data, input.inviteToken ? 'Welcome to the team!' : 'Organisation created!');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Registration failed'));
        throw error;
      }
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    // Clear locally even if the server call fails (e.g. offline).
    await authApi.logout().catch(() => {});
    queryClient.clear();
    queryClient.setQueryData(meQueryKey, null);
    toast.success('Logged out successfully');
    router.push('/login');
  }, [queryClient, router]);

  const value = useMemo(
    () => ({ user: me.data ?? null, login, register, logout, isLoading: me.isPending }),
    [me.data, me.isPending, login, register, logout],
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
