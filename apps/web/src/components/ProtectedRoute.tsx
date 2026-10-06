'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './AppShell/Sidebar';
import Topbar from './AppShell/Topbar';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
import { ShieldOff } from 'lucide-react';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Only render children for this role; other signed-in users see an access notice. */
  requireRole?: Role;
}

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-50 flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          {requireRole && user.role !== requireRole ? (
            <EmptyState
              icon={ShieldOff}
              title="You don't have access to this page"
              description={`This area is limited to the ${requireRole.toLowerCase()} role.`}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
