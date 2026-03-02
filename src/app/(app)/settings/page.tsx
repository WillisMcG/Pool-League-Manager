'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardHeader, CardBody, Select } from '@/components/ui';
import { updateSettings } from './actions';
import { VenuesSection } from './venues-section';
import { SeasonsSection } from './seasons-section';

const DAY_LABELS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

export default function SettingsPage() {
  const { membership, loading: authLoading } = useAuth();
  const { settings, loading: orgLoading, refreshOrg } = useOrg();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [playDays, setPlayDays] = useState<number[]>(settings?.play_days || [2]);

  // Sync play_days when settings load
  const [initialized, setInitialized] = useState(false);
  if (settings && !initialized) {
    setPlayDays(settings.play_days || [2]);
    setInitialized(true);
  }

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (membership?.role !== 'admin') {
    return (
      <div className="text-center py-12 text-slate-500">
        Only league administrators can access settings.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    formData.set('play_days', playDays.join(','));

    const result = await updateSettings(formData);
    if (result.error) {
      toast(result.error, 'error');
    } else {
      toast('Settings updated');
      await refreshOrg();
    }
    setSaving(false);
  }

  function toggleDay(day: number) {
    setPlayDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black text-slate-800 mb-6">Settings</h1>

      {/* League Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-bold text-slate-800">League Format</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                id="matches_per_night"
                name="matches_per_night"
                label="Matches Per Night"
                defaultValue={settings?.matches_per_night?.toString() || '5'}
                options={[
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                  { value: '3', label: '3' },
                  { value: '4', label: '4' },
                  { value: '5', label: '5' },
                  { value: '6', label: '6' },
                  { value: '7', label: '7' },
                ]}
              />

              <Select
                id="best_of"
                name="best_of"
                label="Best Of"
                defaultValue={settings?.best_of?.toString() || '3'}
                options={[
                  { value: '1', label: 'Best of 1' },
                  { value: '3', label: 'Best of 3' },
                  { value: '5', label: 'Best of 5' },
                  { value: '7', label: 'Best of 7' },
                ]}
              />

              <Select
                id="frequency"
                name="frequency"
                label="Play Frequency"
                defaultValue={settings?.frequency || 'weekly'}
                options={[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'biweekly', label: 'Biweekly' },
                ]}
              />

              <Select
                id="times_to_play"
                name="times_to_play"
                label="Times to Play Each Team"
                defaultValue={settings?.times_to_play?.toString() || '2'}
                options={[
                  { value: '1', label: '1 (single round-robin)' },
                  { value: '2', label: '2 (home & away)' },
                  { value: '3', label: '3' },
                  { value: '4', label: '4' },
                ]}
              />

              <Select
                id="position_nights"
                name="position_nights"
                label="Position Nights"
                defaultValue={settings?.position_nights?.toString() || '2'}
                options={[
                  { value: '0', label: 'None' },
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                  { value: '3', label: '3' },
                ]}
              />

              <Select
                id="position_night_placement"
                name="position_night_placement"
                label="Position Night Placement"
                defaultValue={settings?.position_night_placement || 'half'}
                options={[
                  { value: 'half', label: 'After each half' },
                  { value: 'end', label: 'End of season' },
                  { value: 'start', label: 'Start of season' },
                ]}
              />

              <Select
                id="bye_points"
                name="bye_points"
                label="Bye Week Points"
                defaultValue={settings?.bye_points || 'win'}
                options={[
                  { value: 'win', label: 'Count as a win' },
                  { value: 'none', label: 'No points' },
                ]}
              />
            </div>

            {/* Play Days (multi-select checkboxes) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Play Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(parseInt(day.value))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      playDays.includes(parseInt(day.value))
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>
                Save Settings
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Venues Section */}
      <VenuesSection />

      {/* Seasons Section */}
      <SeasonsSection />
    </div>
  );
}
