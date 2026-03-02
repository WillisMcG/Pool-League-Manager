'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardBody, Badge } from '@/components/ui';
import { ScoreForm } from './ScoreForm';
import { ScoresheetScanner } from '@/components/ScoresheetScanner';
import { submitScores, withdrawSubmission } from './actions';
import type { ScheduleEntry, Player, Submission } from '@/types';
import type { MatchupInput } from '@/lib/validation/score-validation';
import { Send, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface MatchInfo {
  schedule: ScheduleEntry;
  homeTeamName: string;
  awayTeamName: string;
  myTeamId: string;
  status: 'ready' | 'pending' | 'conflict' | 'completed';
  mySubmission?: Submission;
}

export default function SubmitScoresPage() {
  const { membership, organization, profile } = useAuth();
  const { currentSeason, settings } = useOrg();
  const { toast } = useToast();

  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsedMatchups, setParsedMatchups] = useState<MatchupInput[] | undefined>();

  const supabase = createClient();
  const isAdmin = membership?.role === 'admin';

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, currentSeason?.id, profile?.id]);

  async function loadData() {
    if (!organization || !currentSeason || !profile) {
      setLoading(false);
      return;
    }

    // Get teams for this season
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, captain_profile_id')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id);
    if (!teams) { setLoading(false); return; }

    const teamMap = new Map(teams.map(t => [t.id, t.name]));

    // Determine which teams this user can submit for
    const myTeamIds = isAdmin
      ? teams.map(t => t.id)
      : teams.filter(t => t.captain_profile_id === profile.id).map(t => t.id);

    if (myTeamIds.length === 0) {
      setLoading(false);
      return;
    }

    // Get schedule entries (non-bye)
    const { data: scheduleData } = await supabase
      .from('schedule')
      .select('*')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id)
      .eq('is_bye', false)
      .order('week')
      .order('created_at');
    if (!scheduleData) { setLoading(false); return; }

    // Get existing matches (completed)
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('schedule_id')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id);
    const completedScheduleIds = new Set((existingMatches || []).map(m => m.schedule_id));

    // Get existing submissions
    const { data: existingSubs } = await supabase
      .from('submissions')
      .select('*')
      .eq('org_id', organization.id)
      .eq('season_id', currentSeason.id);
    const subsBySchedule = new Map<string, Submission[]>();
    for (const sub of (existingSubs || []) as Submission[]) {
      const list = subsBySchedule.get(sub.schedule_id) || [];
      list.push(sub);
      subsBySchedule.set(sub.schedule_id, list);
    }

    // Build match info list
    const matchInfos: MatchInfo[] = [];
    for (const sched of scheduleData as ScheduleEntry[]) {
      // Skip completed matches
      if (completedScheduleIds.has(sched.id)) continue;

      // Check if this user's team is involved
      const involvedTeamId = myTeamIds.find(
        tid => tid === sched.home_team_id || tid === sched.away_team_id
      );
      if (!involvedTeamId) continue;

      const subs = subsBySchedule.get(sched.id) || [];
      const mySub = subs.find(s => s.team_id === involvedTeamId);
      const otherSub = subs.find(s => s.team_id !== involvedTeamId);

      let status: MatchInfo['status'] = 'ready';
      if (mySub && otherSub) {
        status = 'conflict'; // both submitted but not auto-approved means conflict
      } else if (mySub) {
        status = 'pending'; // waiting for other team
      }

      matchInfos.push({
        schedule: sched,
        homeTeamName: teamMap.get(sched.home_team_id) || sched.home_team_id,
        awayTeamName: teamMap.get(sched.away_team_id) || sched.away_team_id,
        myTeamId: involvedTeamId,
        status,
        mySubmission: mySub,
      });
    }

    setMatches(matchInfos);
    setLoading(false);
  }

  async function selectMatch(match: MatchInfo) {
    if (!organization || !currentSeason) return;

    // Load rosters for both teams
    const [homeRes, awayRes] = await Promise.all([
      supabase
        .from('players')
        .select('*')
        .eq('team_id', match.schedule.home_team_id)
        .eq('org_id', organization.id)
        .order('name'),
      supabase
        .from('players')
        .select('*')
        .eq('team_id', match.schedule.away_team_id)
        .eq('org_id', organization.id)
        .order('name'),
    ]);

    setHomeRoster((homeRes.data as Player[]) || []);
    setAwayRoster((awayRes.data as Player[]) || []);
    setParsedMatchups(undefined);
    setSelectedMatch(match);
  }

  async function handleSubmit(matchups: MatchupInput[]) {
    if (!selectedMatch || !currentSeason || !settings) return;

    const result = await submitScores({
      scheduleId: selectedMatch.schedule.id,
      teamId: selectedMatch.myTeamId,
      seasonId: currentSeason.id,
      matchups,
      matchesPerNight: settings.matches_per_night,
      bestOf: settings.best_of,
    });

    if (result.error) {
      toast(result.error, 'error');
      return;
    }

    if (result.status === 'pending') {
      toast('Scores submitted! Waiting for the other team.', 'success');
    } else if (result.status === 'auto_approved') {
      toast('Scores submitted and auto-approved! Both teams agree.', 'success');
    } else if (result.status === 'conflict') {
      toast('Scores submitted but there\'s a conflict. An admin will review.', 'info');
    }

    setSelectedMatch(null);
    setLoading(true);
    await loadData();
  }

  async function handleWithdraw(submission: Submission) {
    const result = await withdrawSubmission(submission.id);
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    toast('Submission withdrawn.', 'success');
    setLoading(true);
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If a match is selected, show the score form
  if (selectedMatch) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-black text-slate-800 mb-4">Submit Scores</h1>
        <p className="text-sm text-slate-500 mb-4">
          Week {selectedMatch.schedule.week} &mdash;{' '}
          {new Date(selectedMatch.schedule.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </p>
        <ScoresheetScanner
          homeTeamName={selectedMatch.homeTeamName}
          awayTeamName={selectedMatch.awayTeamName}
          homeRoster={homeRoster.map(p => p.name)}
          awayRoster={awayRoster.map(p => p.name)}
          matchesPerNight={settings?.matches_per_night || 5}
          bestOf={settings?.best_of || 3}
          onParsed={setParsedMatchups}
        />
        <ScoreForm
          homeTeamName={selectedMatch.homeTeamName}
          awayTeamName={selectedMatch.awayTeamName}
          homeRoster={homeRoster}
          awayRoster={awayRoster}
          matchesPerNight={settings?.matches_per_night || 5}
          bestOf={settings?.best_of || 3}
          onSubmit={handleSubmit}
          onCancel={() => setSelectedMatch(null)}
          initialMatchups={parsedMatchups}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800">
          Submit Scores
          {currentSeason && (
            <span className="text-base font-normal text-slate-500 ml-3">
              {currentSeason.name}
            </span>
          )}
        </h1>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {isAdmin
                  ? 'No matches awaiting score submission.'
                  : 'No matches to submit. You may not be a team captain, or all scores are submitted.'}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map(match => (
            <Card key={match.schedule.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-700">
                        Week {match.schedule.week}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(match.schedule.date + 'T12:00:00').toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </span>
                      {match.schedule.is_position_night && (
                        <Badge variant="warning">Position Night</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{match.homeTeamName}</span>
                      <span className="text-slate-400 mx-2">vs</span>
                      <span className="font-medium">{match.awayTeamName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {match.status === 'ready' && (
                      <>
                        <Badge variant="default">
                          <CheckCircle className="w-3 h-3 mr-1 inline" />
                          Ready
                        </Badge>
                        <Button size="sm" onClick={() => selectMatch(match)}>
                          Enter Scores
                        </Button>
                      </>
                    )}
                    {match.status === 'pending' && (
                      <>
                        <Badge variant="info">
                          <Clock className="w-3 h-3 mr-1 inline" />
                          Awaiting Other Team
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => match.mySubmission && handleWithdraw(match.mySubmission)}
                        >
                          Withdraw
                        </Button>
                      </>
                    )}
                    {match.status === 'conflict' && (
                      <Badge variant="danger">
                        <AlertTriangle className="w-3 h-3 mr-1 inline" />
                        Conflict — Admin Review
                      </Badge>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
