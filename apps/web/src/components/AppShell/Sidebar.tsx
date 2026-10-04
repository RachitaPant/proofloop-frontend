'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Home, FileText, GitBranch, BarChart3, LogOut } from 'lucide-react';
import { Role } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/requests', label: 'Requests', icon: FileText },
  { href: '/dashboard/workflows', label: 'Workflows', icon: GitBranch },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-surface-200 bg-surface-50 h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-surface-200">
        <ShieldCheck className="w-5 h-5 text-brand-600" />
        <span className="font-display font-bold text-navy-900">ProofLoop</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
              isActive(href) ? 'bg-brand-50 text-brand-700' : 'text-navy-500 hover:bg-surface-50 hover:text-navy-800',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        {user?.role === Role.ADMIN && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
              isActive('/admin') ? 'bg-brand-50 text-brand-700' : 'text-navy-500 hover:bg-surface-50 hover:text-navy-800',
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-surface-200">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 text-sm">
            <div className="font-medium text-navy-900 truncate leading-tight">{user?.name}</div>
            <div className="text-navy-400 text-xs leading-tight">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 rounded-md text-sm font-medium text-navy-500 hover:text-navy-900 hover:bg-surface-50 transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
