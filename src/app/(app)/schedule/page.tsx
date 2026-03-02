'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Button, Card, CardBody, Badge } from '@/components/ui';
import type { ScheduleEntry } from '@/types';
import { Calendar, Plus } from 'lucide-react';

interface WeekGroup {
  week: number;
  date: string;
  half: number;
  entries: ScheduleEntry[];
}

export default function SchedulePage() {
  const { membership, organization } = useAuth();
  const { currentSeason } = useOrg();
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const isAdmin = membership?.role === 'admin';

  useEffect(() => {
    async function load() {
      if (!organization || !currentSeason) {
        setLoading(false);
        return;
      }

      const [schedRes, teamsRes] = await Promise.all([
        supabase
          .from('schedule')
          .select('*')
          .eq('org_id', organization.id)
          .eq('season_id', currentSeason.id)
          .order('week')
          .order('created_at'),
        supabase
          .from('teams')
          .select('id, name')
          .eq('org_id', organization.id)
          .eq('season_id', currentSeason.id),
      ]);

      const entries = (schedRes.data as ScheduleEntry[]) || [];
      const teamMap = new Map(
        (teamsRes.data || []).map((t: { id: string; name: string }) => [t.id, t.name])
      );
      setTeams(teamMap);

      // Group by week
      const grouped = new Map<number, WeekGroup>();
      for (const entry of entries) {
        if (!grouped.has(entry.week)) {
          grouped.set(entry.week, {
            week: entry.week,
            date: entry.date,
            half: entry.half,
            entries: [],
          });
        }
        grouped.get(entry.week)!.entries.push(entry);
      }
      setWeeks(Array.from(grouped.values()));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, currentSeason?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800">
          Schedule
          {currentSeason && (
            <span className="text-base font-normal text-slate-500 ml-3">
              {currentSeason.name}
            </span>
          )}
        </h1>
        {isAdmin && (
          <Link href="/schedule/generate">
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              Generate Schedule
            </Button>
          </Link>
        )}
      </div>

      {weeks.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No schedule generated yet.</p>
              {isAdmin && (
                <Link href="/schedule/generate">
                  <Button className="mt-4" variant="secondary">
                    Generate Schedule
                  </Button>
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {weeks.map(week => (
            <Card key={week.week}>
              <CardBody>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-slate-700">
                    Week {week.week}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(week.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <Badge variant="info">Half {week.half}</Badge>
                  {week.entries.some(e => e.is_position_night) && (
                    <Badge variant="warning">Position Night</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {week.entries.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {entry.is_bye ? (
                          <>
                            <span className="font-medium text-slate-700">
                              {teams.get(entry.home_team_id) || entry.home_team_id}
                            </span>
                            <Badge variant="default">BYE</Badge>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-slate-700">
                              {teams.get(entry.home_team_id) || entry.home_team_id}
                            </span>
                            <span className="text-slate-400">vs</span>
                            <span className="font-medium text-slate-700">
                              {teams.get(entry.away_team_id) || entry.away_team_id}
                            </span>
                          </>
                        )}
                        {entry.is_position_night && entry.position_home && entry.position_away && (
                          <span className="text-xs text-amber-600">
                            (#{entry.position_home} vs #{entry.position_away})
                          </span>
                        )}
                      </div>
                      {entry.venue && (
                        <span className="text-xs text-slate-500">@ {entry.venue}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
