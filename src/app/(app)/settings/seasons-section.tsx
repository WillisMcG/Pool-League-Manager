'use client';

import { useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardHeader, CardBody, Input, Modal, Badge, Table, Thead, Th, Td, Tr } from '@/components/ui';
import { createSeason, updateSeason, archiveSeason } from './actions';
import type { Season } from '@/types';
import { Pencil, Archive, Plus } from 'lucide-react';

const STATUS_BADGE: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  archived: 'warning',
};

export function SeasonsSection() {
  const { allSeasons, refreshOrg } = useOrg();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(season: Season) {
    setEditing(season);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const result = editing
      ? await updateSeason(formData)
      : await createSeason(formData);

    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast(editing ? 'Season updated' : 'Season created');
      setModalOpen(false);
      await refreshOrg();
    }
    setSaving(false);
  }

  async function handleArchive(season: Season) {
    if (!confirm(`Archive "${season.name}"? It will no longer appear in the season switcher.`)) return;

    const formData = new FormData();
    formData.set('id', season.id);
    const result = await archiveSeason(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Season archived');
      await refreshOrg();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Seasons</h2>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Season
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {allSeasons.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">
            No seasons yet. Create your first season to get started.
          </p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th className="w-24">Actions</Th>
              </tr>
            </Thead>
            <tbody>
              {allSeasons.map(season => (
                <Tr key={season.id}>
                  <Td className="font-medium">{season.name}</Td>
                  <Td>
                    <Badge variant={STATUS_BADGE[season.status] || 'default'}>
                      {season.status}
                    </Badge>
                  </Td>
                  <Td className="text-slate-500">
                    {season.start_date
                      ? new Date(season.start_date).toLocaleDateString()
                      : '—'}
                  </Td>
                  <Td className="text-slate-500">
                    {season.end_date
                      ? new Date(season.end_date).toLocaleDateString()
                      : '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(season)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {season.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(season)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100"
                          title="Archive season"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Season' : 'New Season'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Input
            id="season-name"
            name="name"
            label="Season Name"
            defaultValue={editing?.name || ''}
            placeholder="e.g. Fall 2025"
            required
          />
          {editing && (
            <>
              <Input
                id="season-start"
                name="start_date"
                label="Start Date"
                type="date"
                defaultValue={editing.start_date || ''}
              />
              <Input
                id="season-end"
                name="end_date"
                label="End Date"
                type="date"
                defaultValue={editing.end_date || ''}
              />
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save' : 'Create Season'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
