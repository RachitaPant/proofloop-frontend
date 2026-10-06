'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, Bell, ShieldCheck, Home, FileText, GitBranch, BarChart3 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';
import { cn } from '@/lib/cn';

const MOBILE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/requests', label: 'Requests', icon: FileText },
  { href: '/dashboard/workflows', label: 'Workflows', icon: GitBranch },
];

export default function Topbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xs border-b border-surface-200">
      <div className="h-16 flex items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2 md:hidden font-display font-bold text-navy-900">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          ProofLoop
        </div>

        <div className="hidden sm:flex items-center gap-2 text-sm text-navy-400 bg-surface-50 border border-surface-200 rounded-md px-3 py-2 w-full max-w-xs">
          <Search className="w-4 h-4" />
          <span>Search requests, workflows…</span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => toast('No new notifications')}
            className="text-navy-400 hover:text-navy-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            onClick={logout}
            className="md:hidden w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center text-xs font-semibold"
            aria-label="Logout"
          >
            {user?.name?.charAt(0).toUpperCase()}
          </button>
        </div>
      </div>

      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
        {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150',
              pathname === href ? 'bg-brand-50 text-brand-700' : 'text-navy-500 hover:bg-surface-50',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        ))}
        {user?.role === Role.ADMIN && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150',
              pathname === '/admin' ? 'bg-brand-50 text-brand-700' : 'text-navy-500 hover:bg-surface-50',
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </Link>
        )}
      </nav>
    </header>
  );
}
