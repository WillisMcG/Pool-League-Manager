'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Trophy,
  Users,
  ClipboardCheck,
  BarChart3,
  History,
  Settings,
  Shield,
  Send,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'captain', 'player'] },
  { href: '/schedule', label: 'Schedule', icon: Calendar, roles: ['admin', 'captain', 'player'] },
  { href: '/standings', label: 'Standings', icon: Trophy, roles: ['admin', 'captain', 'player'] },
  { href: '/players', label: 'Players', icon: Users, roles: ['admin', 'captain', 'player'] },
  { href: '/history', label: 'History', icon: History, roles: ['admin', 'captain', 'player'] },
  { href: '/submit', label: 'Submit Scores', icon: Send, roles: ['admin', 'captain'] },
  { href: '/teams', label: 'Teams', icon: Users, roles: ['admin', 'captain', 'player'] },
  { href: '/admin', label: 'Admin', icon: ClipboardCheck, roles: ['admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { membership, profile } = useAuth();
  const role = membership?.role || 'player';

  const filteredItems = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <span className="text-3xl">🎱</span>
          <span className="text-lg font-black text-white">Pool League</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}

          {profile?.is_super_admin && (
            <Link
              href="/super-admin"
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors mt-4 border-t border-slate-700 pt-4',
                pathname.startsWith('/super-admin')
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Shield className="w-5 h-5" />
              Super Admin
            </Link>
          )}
        </nav>
      </div>
    </aside>
  );
}
