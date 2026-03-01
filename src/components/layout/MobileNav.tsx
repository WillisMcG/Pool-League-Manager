'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Calendar, Trophy, Send, Users, Settings } from 'lucide-react';

const mobileItems = [
  { href: '/schedule', label: 'Schedule', icon: Calendar, roles: ['admin', 'captain', 'player'] },
  { href: '/standings', label: 'Standings', icon: Trophy, roles: ['admin', 'captain', 'player'] },
  { href: '/submit', label: 'Submit', icon: Send, roles: ['admin', 'captain'] },
  { href: '/teams', label: 'Teams', icon: Users, roles: ['admin', 'captain', 'player'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

export function MobileNav() {
  const pathname = usePathname();
  const { membership } = useAuth();
  const role = membership?.role || 'player';

  const items = mobileItems.filter(item => item.roles.includes(role));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-bottom">
      <div className="flex justify-around py-2">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-emerald-600' : 'text-slate-500'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
