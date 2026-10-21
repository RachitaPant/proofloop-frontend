'use client';

import toast from 'react-hot-toast';
import { Search, Bell, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function Topbar() {
  const { logout } = useAuth();

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
            className="md:hidden text-navy-400 hover:text-navy-700 transition-colors"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

    </header>
  );
}
