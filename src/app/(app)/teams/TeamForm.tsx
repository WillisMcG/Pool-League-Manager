'use client';

import { Button, Input, Select } from '@/components/ui';
import type { Team, Venue } from '@/types';

interface TeamFormProps {
  team?: Team;
  venues: Venue[];
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export function TeamForm({ team, venues, saving, onSubmit, onCancel }: TeamFormProps) {
  const venueOptions = [
    { value: '', label: 'No venue' },
    ...venues.map(v => ({ value: v.name, label: v.name })),
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {team && <input type="hidden" name="id" value={team.id} />}
      <Input
        id="team-name"
        name="name"
        label="Team Name"
        defaultValue={team?.name || ''}
        required
      />
      <Select
        id="team-venue"
        name="venue"
        label="Home Venue"
        defaultValue={team?.venue || ''}
        options={venueOptions}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {team ? 'Save' : 'Create Team'}
        </Button>
      </div>
    </form>
  );
}
