'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardBody, Table, Thead, Th, Td, Tr } from '@/components/ui';
import {
  calcStandings,
  type StandingRow,
  type StandingsMatch,
  type StandingsScheduleEntry,
  type StandingsAdjustmentInput,
} from '@/lib/standings/calc-standings';
import { getTierLimits } from '@/lib/subscription/features';
import { ChevronLeft, Trophy, Lock } from 'lucide-react';

interface MatchRow {
  date: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export default function SeasonHistoryDetailPage() {
  const params = useParams<{ seasonId: string }>();
  const seasonId = params.seasonId;
  const { organization } = useAuth();
  const { allSeasons, settings, loading: orgLoading } = useOrg();

  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const season = allSeasons.find(s => s.id === seasonId);
  const limits = getTierLimits(organization?.subscription_tier);
  const historyEnabled = limits.maxSeasonsHistory !== 0;

  useEffect(() => {
    async function load() {
      if (!organization || !seasonId || !historyEnabled) {
        setLoading(false);
        return;
      }

      const [teamsRes, matchesRes, schedRes, adjRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name')
          .eq('org_id', organization.id)
          .eq('season_id', seasonId)
          .order('name'),
        supabase
          .from('matches')
          .select('*, schedule_entry:schedule!inner(week, date, home_team_id, away_team_id, is_position_night)')
          .eq('org_id', organization.id)
          .eq('season_id', seasonId)
          .eq('approved', true),
        supabase
          .from('schedule')
          .select('home_team_id, away_team_id, date, is_bye, is_position_night')
          .eq('org_id', organization.id)
          .eq('season_id', seasonId),
        supabase
          .from('standings_adjustments')
          .select('*')
          .eq('org_id', organization.id)
          .eq('season_id', seasonId),
      ]);

      const teams = (teamsRes.data || []).map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      }));
      const teamById = new Map(teams.map(t => [t.id, t.name]));

      const rawMatches = (matchesRes.data || []) as Record<string, unknown>[];

      const standingsMatches: StandingsMatch[] = rawMatches.map(m => {
        const sched = m.schedule_entry as Record<string, unknown> | undefined;
        return {
          homeTeamId: (sched?.home_team_id as string) || '',
          awayTeamId: (sched?.away_team_id as string) || '',
          homeScore: m.home_score as number,
          awayScore: m.away_score as number,
          matchups: Array.isArray(m.matchups)
            ? (m.matchups as Record<string, unknown>[]).map(mu => ({
                homeWins: (mu.home_wins as number) || 0,
                awayWins: (mu.away_wins as number) || 0,
              }))
            : [],
          isPositionNight: (sched?.is_position_night as boolean) || false,
        };
      });

      const matchList: MatchRow[] = rawMatches
        .map(m => {
          const sched = m.schedule_entry as Record<string, unknown> | undefined;
          return {
            date: (sched?.date as string) || '',
            week: (sched?.week as number) || 0,
            homeTeam: teamById.get(sched?.home_team_id as string) || 'Unknown',
            awayTeam: teamById.get(sched?.away_team_id as string) || 'Unknown',
            homeScore: m.home_score as number,
            awayScore: m.away_score as number,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week);

      const scheduleEntries: StandingsScheduleEntry[] = (schedRes.data || []).map(
        (e: Record<string, unknown>) => ({
          homeTeamId: e.home_team_id as string,
          awayTeamId: e.away_team_id as string,
          date: e.date as string,
          isBye: e.is_bye as boolean,
          isPositionNight: e.is_position_night as boolean,
        }),
      );

      const adjustments: StandingsAdjustmentInput[] = (adjRes.data || []).map(
        (a: Record<string, unknown>) => ({
          teamId: a.team_id as string,
          winsAdj: a.wins_adj as number,
          lossesAdj: a.losses_adj as number,
          gamesWonAdj: a.games_won_adj as number,
          gamesLostAdj: a.games_lost_adj as number,
        }),
      );

      const result = calcStandings({
        teams,
        matches: standingsMatches,
        scheduleEntries,
        adjustments,
        byePoints: settings?.bye_points || 'win',
        // Past-season standings freeze at season end; if unavailable, use today
        // (still safe — bye_points only matters for dates <= today).
        today: season?.end_date || new Date().toISOString().split('T')[0],
      });

      setStandings(result);
      setMatches(matchList);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, seasonId, historyEnabled, season?.end_date]);

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!historyEnabled) {
    return (
      <div className="max-w-4xl">
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-medium mb-1">Season history is a paid feature</p>
              <Link
                href="/settings"
                className="inline-flex items-center mt-3 px-4 py-2 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700"
              >
                See plans
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-4xl">
        <Link href="/history" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to history
        </Link>
        <Card>
          <CardBody>
            <p className="text-slate-500 text-center py-8">Season not found.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const champion = standings[0];

  return (
    <div className="max-w-4xl">
      <Link href="/history" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to history
      </Link>

      <h1 className="text-2xl font-black text-slate-800 mb-1">{season.name}</h1>
      {(season.start_date || season.end_date) && (
        <p className="text-slate-500 mb-6">
          {season.start_date || '?'} to {season.end_date || '?'}
        </p>
      )}

      {champion && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardBody>
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-emerald-600" />
              <div>
                <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Champion</div>
                <div className="text-lg font-bold text-slate-800">{champion.teamName}</div>
                <div className="text-sm text-slate-600">
                  {champion.wins}–{champion.losses} · {(champion.matchPct * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <h2 className="text-lg font-bold text-slate-800 mb-3">Final standings</h2>
      <Card className="mb-8">
        <CardBody>
          {standings.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No matches were recorded this season.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[480px] px-4 sm:px-0">
                <Table>
                  <Thead>
                    <tr>
                      <Th className="w-12">#</Th>
                      <Th>Team</Th>
                      <Th className="text-right">W</Th>
                      <Th className="text-right">L</Th>
                      <Th className="text-right">Win%</Th>
                      <Th className="text-right">GW</Th>
                      <Th className="text-right">GL</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {standings.map(row => (
                      <Tr key={row.teamId}>
                        <Td className="font-bold text-slate-500">{row.rank}</Td>
                        <Td className="font-medium">{row.teamName}</Td>
                        <Td className="text-right">{row.wins}</Td>
                        <Td className="text-right">{row.losses}</Td>
                        <Td className="text-right">{(row.matchPct * 100).toFixed(1)}%</Td>
                        <Td className="text-right">{row.gamesWon}</Td>
                        <Td className="text-right">{row.gamesLost}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <h2 className="text-lg font-bold text-slate-800 mb-3">Match results</h2>
      <Card>
        <CardBody>
          {matches.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No approved matches for this season.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {matches.map((m, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="text-sm text-slate-500 w-20 shrink-0">Wk {m.week}</div>
                  <div className="flex-1 flex items-center justify-between gap-3">
                    <span className={`font-medium ${m.homeScore > m.awayScore ? 'text-slate-900' : 'text-slate-500'}`}>
                      {m.homeTeam}
                    </span>
                    <span className="font-mono text-slate-800 whitespace-nowrap">
                      {m.homeScore} – {m.awayScore}
                    </span>
                    <span className={`font-medium text-right ${m.awayScore > m.homeScore ? 'text-slate-900' : 'text-slate-500'}`}>
                      {m.awayTeam}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
