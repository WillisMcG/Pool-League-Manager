'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardBody } from '@/components/ui';
import { getTierLimits } from '@/lib/subscription/features';
import { History as HistoryIcon, ChevronRight, Lock } from 'lucide-react';

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = start ? new Date(start).toLocaleDateString(undefined, opts) : '?';
  const e = end ? new Date(end).toLocaleDateString(undefined, opts) : '?';
  return `${s} – ${e}`;
}

export default function HistoryPage() {
  const { organization } = useAuth();
  const { allSeasons, loading } = useOrg();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const limits = getTierLimits(organization?.subscription_tier);
  const historyEnabled = limits.maxSeasonsHistory !== 0;

  const pastSeasons = allSeasons
    .filter(s => s.status !== 'active')
    .sort((a, b) => (b.end_date || b.created_at).localeCompare(a.end_date || a.created_at));

  const visibleSeasons =
    limits.maxSeasonsHistory === -1
      ? pastSeasons
      : pastSeasons.slice(0, limits.maxSeasonsHistory);
  const hiddenCount = pastSeasons.length - visibleSeasons.length;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black text-slate-800 mb-6">History</h1>

      {!historyEnabled ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-medium mb-1">Season history is a paid feature</p>
              <p className="text-slate-500 mb-4">
                Upgrade to see final standings and match results from past seasons.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700"
              >
                See plans
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : pastSeasons.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <HistoryIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No past seasons yet. Completed seasons will appear here.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {visibleSeasons.map(season => (
                <li key={season.id}>
                  <Link
                    href={`/history/${season.id}`}
                    className="flex items-center justify-between px-2 py-4 hover:bg-slate-50 rounded-md"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{season.name}</div>
                      <div className="text-sm text-slate-500">
                        {formatDateRange(season.start_date, season.end_date)}
                        {season.status === 'archived' && (
                          <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">Archived</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <div className="mt-4 text-sm text-slate-500 text-center">
                {hiddenCount} older season{hiddenCount === 1 ? '' : 's'} hidden by your plan.{' '}
                <Link href="/settings" className="text-emerald-700 font-medium hover:underline">
                  Upgrade to see all history
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
