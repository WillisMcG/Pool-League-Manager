'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardBody, Modal, Table, Thead, Th, Td, Tr } from '@/components/ui';
import { TeamForm } from './TeamForm';
import { createTeam, deleteTeam } from './actions';
import type { Team, Venue } from '@/types';
import { Plus, Trash2, ChevronRight } from 'lucide-react';

export default function TeamsPage() {
  const { membership, organization } = useAuth();
  const { currentSeason } = useOrg();
  const { toast } = useToast();
  const [teams, setTeams] = useState<(Team & { player_count: number })[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const isAdmin = membership?.role === 'admin';

  async function loadTeams() {
    if (!organization || !currentSeason) return;

    const [teamsRes, venuesRes] = await Promise.all([
      supabase
        .from('teams')
        .select('*, players(id)')
        .eq('org_id', organization.id)
        .eq('season_id', currentSeason.id)
        .order('name'),
      supabase
        .from('venues')
        .select('*')
        .eq('org_id', organization.id)
        .order('name'),
    ]);

    const teamsWithCount = (teamsRes.data || []).map((t: Record<string, unknown>) => ({
      ...t,
      player_count: Array.isArray(t.players) ? t.players.length : 0,
      players: undefined,
    })) as (Team & { player_count: number })[];

    setTeams(teamsWithCount);
    setVenues((venuesRes.data as Venue[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, currentSeason?.id]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    formData.set('season_id', currentSeason!.id);

    const result = await createTeam(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Team created');
      setModalOpen(false);
      await loadTeams();
    }
    setSaving(false);
  }

  async function handleDelete(team: Team) {
    if (!confirm(`Delete "${team.name}"? This will also remove all players on this team.`)) return;

    const formData = new FormData();
    formData.set('id', team.id);
    const result = await deleteTeam(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Team deleted');
      await loadTeams();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentSeason) {
    return (
      <div className="text-center py-12 text-slate-500">
        No active season. Create a season in Settings first.
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800">
          Teams
          <span className="text-base font-normal text-slate-500 ml-3">
            {currentSeason.name}
          </span>
        </h1>
        {isAdmin && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Team
          </Button>
        )}
      </div>

      <Card>
        <CardBody>
          {teams.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">
              No teams yet for this season.{' '}
              {isAdmin && 'Click "Add Team" to create one.'}
            </p>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Team</Th>
                  <Th>Venue</Th>
                  <Th>Players</Th>
                  {isAdmin && <Th className="w-20">Actions</Th>}
                </tr>
              </Thead>
              <tbody>
                {teams.map(team => (
                  <Tr key={team.id}>
                    <Td>
                      <Link
                        href={`/teams/${team.id}`}
                        className="font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        {team.name}
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </Td>
                    <Td className="text-slate-500">{team.venue || '—'}</Td>
                    <Td>{team.player_count}</Td>
                    {isAdmin && (
                      <Td>
                        <button
                          onClick={() => handleDelete(team)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Team"
        size="sm"
      >
        <TeamForm
          venues={venues}
          saving={saving}
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
