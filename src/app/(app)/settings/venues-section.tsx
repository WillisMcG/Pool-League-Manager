'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardHeader, CardBody, Input, Modal, Table, Thead, Th, Td, Tr } from '@/components/ui';
import { createVenue, updateVenue, deleteVenue } from './actions';
import type { Venue } from '@/types';
import { Pencil, Trash2, Plus } from 'lucide-react';

export function VenuesSection() {
  const { organization } = useAuth();
  const { toast } = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);

  const supabase = createClient();

  async function loadVenues() {
    if (!organization) return;
    const { data } = await supabase
      .from('venues')
      .select('*')
      .eq('org_id', organization.id)
      .order('name');
    setVenues((data as Venue[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(venue: Venue) {
    setEditing(venue);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const result = editing
      ? await updateVenue(formData)
      : await createVenue(formData);

    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast(editing ? 'Venue updated' : 'Venue added');
      setModalOpen(false);
      await loadVenues();
    }
    setSaving(false);
  }

  async function handleDelete(venue: Venue) {
    if (!confirm(`Delete "${venue.name}"? This cannot be undone.`)) return;

    const formData = new FormData();
    formData.set('id', venue.id);
    const result = await deleteVenue(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Venue deleted');
      await loadVenues();
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Venues</h2>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Add Venue
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : venues.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">
            No venues yet. Add your first venue to get started.
          </p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Name</Th>
                <Th>Address</Th>
                <Th className="w-24">Actions</Th>
              </tr>
            </Thead>
            <tbody>
              {venues.map(venue => (
                <Tr key={venue.id}>
                  <Td className="font-medium">{venue.name}</Td>
                  <Td className="text-slate-500">{venue.address || '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(venue)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(venue)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        title={editing ? 'Edit Venue' : 'Add Venue'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Input
            id="venue-name"
            name="name"
            label="Venue Name"
            defaultValue={editing?.name || ''}
            required
          />
          <Input
            id="venue-address"
            name="address"
            label="Address"
            defaultValue={editing?.address || ''}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save' : 'Add Venue'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
