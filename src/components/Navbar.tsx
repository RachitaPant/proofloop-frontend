'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Home, Workflow as WorkflowIcon, FileText, BarChart3, ShieldCheck } from 'lucide-react';
import { Role } from '@/types';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/workflows', label: 'Workflows', icon: WorkflowIcon },
  { href: '/dashboard/requests', label: 'Requests', icon: FileText },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white border-b border-surface-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              Proof<span className="text-brand-600">Loop</span>
            </Link>

            <div className="flex gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
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
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                    isActive('/admin') ? 'bg-brand-50 text-brand-700' : 'text-navy-500 hover:bg-surface-50 hover:text-navy-800',
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-sm">
                <div className="font-medium text-navy-900 leading-tight">{user?.name}</div>
                <div className="text-navy-400 text-xs leading-tight">{user?.role}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-navy-500 hover:text-navy-900 hover:bg-surface-50 rounded-md transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
