'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import {
  Button, Card, CardHeader, CardBody, Input, Modal,
  Table, Thead, Th, Td, Tr, Badge, Select,
} from '@/components/ui';
import { TeamForm } from '../TeamForm';
import { updateTeam, addPlayer, updatePlayer, removePlayer } from '../actions';
import type { Team, Player, Venue } from '@/types';
import { ArrowLeft, Pencil, Trash2, Plus, Star } from 'lucide-react';
import Link from 'next/link';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { membership, organization } = useAuth();
  const { currentSeason } = useOrg();
  const { toast } = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const isAdmin = membership?.role === 'admin';

  async function loadTeam() {
    if (!organization) return;

    const [teamRes, playersRes, venuesRes] = await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .eq('org_id', organization.id)
        .single(),
      supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('org_id', organization.id)
        .order('is_sub')
        .order('name'),
      supabase
        .from('venues')
        .select('*')
        .eq('org_id', organization.id)
        .order('name'),
    ]);

    if (!teamRes.data) {
      router.push('/teams');
      return;
    }

    setTeam(teamRes.data as Team);
    setPlayers((playersRes.data as Player[]) || []);
    setVenues((venuesRes.data as Venue[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, teamId]);

  async function handleUpdateTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateTeam(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Team updated');
      setEditTeamOpen(false);
      await loadTeam();
    }
    setSaving(false);
  }

  async function handlePlayerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    formData.set('team_id', teamId);

    const result = editingPlayer
      ? await updatePlayer(formData)
      : await addPlayer(formData);

    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast(editingPlayer ? 'Player updated' : 'Player added');
      setPlayerModalOpen(false);
      setEditingPlayer(null);
      await loadTeam();
    }
    setSaving(false);
  }

  async function handleRemovePlayer(player: Player) {
    if (!confirm(`Remove "${player.name}" from the team?`)) return;

    const formData = new FormData();
    formData.set('id', player.id);
    formData.set('team_id', teamId);
    const result = await removePlayer(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Player removed');
      await loadTeam();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="max-w-3xl">
      {/* Back link + header */}
      <div className="mb-6">
        <Link
          href="/teams"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Teams
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800">{team.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {team.venue || 'No venue'} &middot; {players.length} player{players.length !== 1 ? 's' : ''}
              {currentSeason && ` &middot; ${currentSeason.name}`}
            </p>
          </div>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={() => setEditTeamOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" />
              Edit Team
            </Button>
          )}
        </div>
      </div>

      {/* Roster */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Roster</h2>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingPlayer(null);
                  setPlayerModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Player
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {players.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              No players on this team yet.
            </p>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  {isAdmin && <Th className="w-28">Actions</Th>}
                </tr>
              </Thead>
              <tbody>
                {players.map(player => (
                  <Tr key={player.id}>
                    <Td className="font-medium">
                      <div className="flex items-center gap-2">
                        {player.name}
                        {team.captain_profile_id && player.profile_id === team.captain_profile_id && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                    </Td>
                    <Td>
                      {player.is_sub ? (
                        <Badge variant="warning">Sub</Badge>
                      ) : (
                        <Badge variant="success">Regular</Badge>
                      )}
                    </Td>
                    {isAdmin && (
                      <Td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingPlayer(player);
                              setPlayerModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemovePlayer(player)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Edit Team Modal */}
      <Modal
        open={editTeamOpen}
        onClose={() => setEditTeamOpen(false)}
        title="Edit Team"
        size="sm"
      >
        <TeamForm
          team={team}
          venues={venues}
          saving={saving}
          onSubmit={handleUpdateTeam}
          onCancel={() => setEditTeamOpen(false)}
        />
      </Modal>

      {/* Add/Edit Player Modal */}
      <Modal
        open={playerModalOpen}
        onClose={() => { setPlayerModalOpen(false); setEditingPlayer(null); }}
        title={editingPlayer ? 'Edit Player' : 'Add Player'}
        size="sm"
      >
        <form onSubmit={handlePlayerSubmit} className="space-y-4">
          {editingPlayer && <input type="hidden" name="id" value={editingPlayer.id} />}
          <Input
            id="player-name"
            name="name"
            label="Player Name"
            defaultValue={editingPlayer?.name || ''}
            required
          />
          <Select
            id="player-is-sub"
            name="is_sub"
            label="Player Type"
            defaultValue={editingPlayer?.is_sub ? 'true' : 'false'}
            options={[
              { value: 'false', label: 'Regular' },
              { value: 'true', label: 'Substitute' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setPlayerModalOpen(false); setEditingPlayer(null); }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingPlayer ? 'Save' : 'Add Player'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
