'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardBody, Table, Thead, Th, Td, Tr, Badge } from '@/components/ui';
import type { Player } from '@/types';
import { Search } from 'lucide-react';

interface PlayerWithTeam extends Player {
  team_name: string;
}

export default function PlayersPage() {
  const { organization } = useAuth();
  const { currentSeason } = useOrg();
  const [players, setPlayers] = useState<PlayerWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const supabase = createClient();

  async function loadPlayers() {
    if (!organization || !currentSeason) return;

    const { data } = await supabase
      .from('players')
      .select('*, team:teams!inner(name, season_id)')
      .eq('org_id', organization.id)
      .eq('team.season_id', currentSeason.id)
      .order('name');

    const mapped = (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      team_name: (p.team as Record<string, unknown>)?.name as string || '',
      team: undefined,
    })) as PlayerWithTeam[];

    setPlayers(mapped);
    setLoading(false);
  }

  useEffect(() => {
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, currentSeason?.id]);

  const filtered = search
    ? players.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.team_name.toLowerCase().includes(search.toLowerCase())
      )
    : players;

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
          Players
          {currentSeason && (
            <span className="text-base font-normal text-slate-500 ml-3">
              {currentSeason.name}
            </span>
          )}
        </h1>
        <span className="text-sm text-slate-500">{players.length} total</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search players or teams..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      <Card>
        <CardBody>
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">
              {search ? 'No players match your search.' : 'No players in this season yet.'}
            </p>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Team</Th>
                  <Th>Type</Th>
                </tr>
              </Thead>
              <tbody>
                {filtered.map(player => (
                  <Tr key={player.id}>
                    <Td className="font-medium">{player.name}</Td>
                    <Td className="text-slate-500">{player.team_name}</Td>
                    <Td>
                      {player.is_sub ? (
                        <Badge variant="warning">Sub</Badge>
                      ) : (
                        <Badge variant="success">Regular</Badge>
                      )}
                    </Td>
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
