'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

export default function DashboardPage() {
  const { profile, organization, membership, loading: authLoading } = useAuth();
  const { currentSeason, loading: orgLoading } = useOrg();

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="text-sm text-slate-500 mb-1">League</div>
          <div className="text-xl font-bold text-slate-800">{organization?.name || '—'}</div>
          <div className="text-sm text-slate-500 mt-1">
            {organization?.subscription_tier === 'trial' ? '14-day trial' : organization?.subscription_tier}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="text-sm text-slate-500 mb-1">Season</div>
          <div className="text-xl font-bold text-slate-800">{currentSeason?.name || '—'}</div>
          <div className="text-sm text-slate-500 mt-1 capitalize">{currentSeason?.status || '—'}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="text-sm text-slate-500 mb-1">Your Role</div>
          <div className="text-xl font-bold text-slate-800 capitalize">{membership?.role || '—'}</div>
          <div className="text-sm text-slate-500 mt-1">{profile?.email}</div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border p-8 text-center text-slate-500">
        <p className="text-lg">Welcome to your new league!</p>
        <p className="mt-2">Start by adding teams in the Teams tab, then generate a schedule.</p>
      </div>
    </div>
  );
}
