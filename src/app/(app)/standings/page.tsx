'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardBody, Table, Thead, Th, Td, Tr } from '@/components/ui';
import { calcStandings, type StandingRow, type StandingsMatch, type StandingsScheduleEntry, type StandingsAdjustmentInput } from '@/lib/standings/calc-standings';
import { Trophy } from 'lucide-react';

export default function StandingsPage() {
  const { organization } = useAuth();
  const { currentSeason, settings } = useOrg();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      if (!organization || !currentSeason) {
        setLoading(false);
        return;
      }

      const [teamsRes, matchesRes, schedRes, adjRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name')
          .eq('org_id', organization.id)
          .eq('season_id', currentSeason.id)
          .order('name'),
        supabase
          .from('matches')
          .select('*, schedule_entry:schedule!inner(home_team_id, away_team_id, is_position_night)')
          .eq('org_id', organization.id)
          .eq('season_id', currentSeason.id)
          .eq('approved', true),
        supabase
          .from('schedule')
          .select('home_team_id, away_team_id, date, is_bye, is_position_night')
          .eq('org_id', organization.id)
          .eq('season_id', currentSeason.id),
        supabase
          .from('standings_adjustments')
          .select('*')
          .eq('org_id', organization.id)
          .eq('season_id', currentSeason.id),
      ]);

      const teams = (teamsRes.data || []).map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      }));

      const matches: StandingsMatch[] = (matchesRes.data || []).map((m: Record<string, unknown>) => {
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

      const scheduleEntries: StandingsScheduleEntry[] = (schedRes.data || []).map((e: Record<string, unknown>) => ({
        homeTeamId: e.home_team_id as string,
        awayTeamId: e.away_team_id as string,
        date: e.date as string,
        isBye: e.is_bye as boolean,
        isPositionNight: e.is_position_night as boolean,
      }));

      const adjustments: StandingsAdjustmentInput[] = (adjRes.data || []).map((a: Record<string, unknown>) => ({
        teamId: a.team_id as string,
        winsAdj: a.wins_adj as number,
        lossesAdj: a.losses_adj as number,
        gamesWonAdj: a.games_won_adj as number,
        gamesLostAdj: a.games_lost_adj as number,
      }));

      const result = calcStandings({
        teams,
        matches,
        scheduleEntries,
        adjustments,
        byePoints: settings?.bye_points || 'win',
        today: new Date().toISOString().split('T')[0],
      });

      setStandings(result);
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
      <h1 className="text-2xl font-black text-slate-800 mb-6">
        Standings
        {currentSeason && (
          <span className="text-base font-normal text-slate-500 ml-3">
            {currentSeason.name}
          </span>
        )}
      </h1>

      <Card>
        <CardBody>
          {standings.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No teams in this season yet.</p>
            </div>
          ) : (
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
                  <Th className="text-right">Game%</Th>
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
                    <Td className="text-right">{(row.gamePct * 100).toFixed(1)}%</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
