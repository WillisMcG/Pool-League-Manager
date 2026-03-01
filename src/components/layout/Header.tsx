'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const router = useRouter();
  const { profile, organization, signOut } = useAuth();
  const { currentSeason, allSeasons, switchSeason } = useOrg();
  const [showSeasons, setShowSeasons] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="font-bold text-slate-800">{organization?.name || 'Pool League'}</h2>
          {currentSeason && (
            <div className="relative">
              <button
                onClick={() => setShowSeasons(!showSeasons)}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                {currentSeason.name}
                {allSeasons.length > 1 && <ChevronDown className="w-3 h-3" />}
              </button>
              {showSeasons && allSeasons.length > 1 && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
                  {allSeasons.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { switchSeason(s.id); setShowSeasons(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      {s.name}
                      {s.status !== 'active' && (
                        <span className="ml-2 text-xs text-slate-400">({s.status})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">{profile?.name}</span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </header>
  );
}
