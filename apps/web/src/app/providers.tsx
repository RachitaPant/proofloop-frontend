'use client';

import { useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { isAxiosError } from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/errors';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { errorMessage?: string };
  }
}

// 401s sign the user out (see the API client interceptor), so don't toast them.
const isUnauthorized = (error: unknown) => isAxiosError(error) && error.response?.status === 401;

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!isUnauthorized(error)) toast.error(getErrorMessage(error, query.meta?.errorMessage));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Retry network/5xx failures once; a 4xx won't fix itself.
        retry: (failureCount, error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session (not per render, and never shared between users on the server).
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '10px',
              background: '#0f1626',
              color: '#fff',
              fontSize: '14px',
            },
          }}
        />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
