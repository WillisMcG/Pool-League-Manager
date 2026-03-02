'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardHeader, CardBody, Input, Badge } from '@/components/ui';
import { generateSchedule, type ScheduleTeam, type ScheduleWeek } from '@/lib/schedule/round-robin';
import { saveSchedule } from '../actions';
import type { Team } from '@/types';
import { ArrowLeft, Calendar, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function GenerateSchedulePage() {
  const router = useRouter();
  const { membership, organization } = useAuth();
  const { currentSeason, settings } = useOrg();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [preview, setPreview] = useState<ScheduleWeek[] | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const isAdmin = membership?.role === 'admin';

  useEffect(() => {
    async function load() {
      if (!organization || !currentSeason) return;
      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('org_id', organization.id)
        .eq('season_id', currentSeason.id)
        .order('name');
      setTeams((data as Team[]) || []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, currentSeason?.id]);

  function handleGenerate() {
    if (!startDate) {
      toast('Please select a start date', 'error');
      return;
    }
    if (teams.length < 2) {
      toast('Need at least 2 teams to generate a schedule', 'error');
      return;
    }

    const schedTeams: ScheduleTeam[] = teams.map(t => ({
      id: t.id,
      name: t.name,
      venue: t.venue,
    }));

    const weeks = generateSchedule({
      teams: schedTeams,
      startDate,
      playDays: settings?.play_days || [2],
      frequency: settings?.frequency || 'weekly',
      timesToPlay: settings?.times_to_play || 2,
      positionNights: settings?.position_nights || 0,
      positionNightPlacement: settings?.position_night_placement || 'half',
    });

    setPreview(weeks);
  }

  async function handleSave() {
    if (!preview || !currentSeason) return;
    setSaving(true);

    const result = await saveSchedule(currentSeason.id, preview);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Schedule saved!');
      router.push('/schedule');
    }
    setSaving(false);
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-slate-500">
        Only administrators can generate schedules.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const teamMap = new Map(teams.map(t => [t.id, t.name]));

  return (
    <div className="max-w-4xl">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Schedule
      </Link>

      <h1 className="text-2xl font-black text-slate-800 mb-6">Generate Schedule</h1>

      {/* Setup */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-bold text-slate-800">Configuration</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Teams ({teams.length})</p>
                <div className="flex flex-wrap gap-1">
                  {teams.map(t => (
                    <Badge key={t.id} variant="default">{t.name}</Badge>
                  ))}
                </div>
                {teams.length < 2 && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Need at least 2 teams. Add teams first.
                  </p>
                )}
                {teams.length % 2 !== 0 && teams.length >= 2 && (
                  <p className="text-sm text-amber-600 mt-2">
                    Odd number of teams — a BYE week will be added.
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Settings</p>
                <ul className="text-sm text-slate-500 space-y-0.5">
                  <li>Frequency: {settings?.frequency || 'weekly'}</li>
                  <li>Times to play: {settings?.times_to_play || 2}</li>
                  <li>Position nights: {settings?.position_nights || 0}</li>
                </ul>
              </div>
            </div>

            <Input
              id="start-date"
              name="start_date"
              label="Season Start Date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />

            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={teams.length < 2 || !startDate}>
                <Calendar className="w-4 h-4 mr-1" />
                Generate Preview
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                Preview ({preview.length} weeks)
              </h2>
              <Button onClick={handleSave} loading={saving}>
                Save Schedule
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {preview.map(week => (
                <div key={week.week} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-700">
                      Week {week.week}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(week.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <Badge variant="info">Half {week.half}</Badge>
                    {week.matches.some(m => m.isPositionNight) && (
                      <Badge variant="warning">Position Night</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    {week.matches.map((match, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        {match.isBye ? (
                          <span>
                            <span className="font-medium">{teamMap.get(match.homeTeamId) || match.homeTeamId}</span>
                            {' '}<Badge variant="default">BYE</Badge>
                          </span>
                        ) : (
                          <span>
                            <span className="font-medium">{teamMap.get(match.homeTeamId) || match.homeTeamId}</span>
                            <span className="text-slate-400 mx-1">vs</span>
                            <span className="font-medium">{teamMap.get(match.awayTeamId) || match.awayTeamId}</span>
                            {match.venue && (
                              <span className="text-slate-400 ml-2">@ {match.venue}</span>
                            )}
                            {match.isPositionNight && match.positionHome && match.positionAway && (
                              <span className="text-xs text-amber-600 ml-2">
                                (#{match.positionHome} vs #{match.positionAway})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
