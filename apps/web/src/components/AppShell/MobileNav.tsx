'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, FileText, GitBranch, Home, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/requests', label: 'Requests', icon: FileText },
  { href: '/dashboard/workflows', label: 'Workflows', icon: GitBranch },
  { href: '/dashboard/delegations', label: 'Delegation', icon: UserCheck },
];

/**
 * Phone navigation: a bottom tab bar where every destination is visible at
 * once (the old top strip scrolled sideways and hid items). Items share the
 * width equally, so five fit even on a 320px screen.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = user?.role === Role.ADMIN ? [...ITEMS, { href: '/admin', label: 'Analytics', icon: BarChart3 }] : ITEMS;

  // Nested pages (a request's detail) keep their section highlighted.
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-surface-200 bg-white/95 backdrop-blur-xs pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href} className="flex-1 min-w-0">
            <Link
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive(href) ? 'text-brand-700' : 'text-navy-500 hover:text-navy-800',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
