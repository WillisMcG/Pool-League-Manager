'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Helper: get org_id from authenticated user ───

async function getOrgId() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();
  if (!profile) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('profile_id', profile.id)
    .single();

  return membership?.org_id || null;
}

// ─── League Settings ───

export async function updateSettings(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const playDaysRaw = formData.get('play_days') as string;
  const playDays = playDaysRaw ? playDaysRaw.split(',').map(Number) : [];

  const { error } = await supabase
    .from('league_settings')
    .update({
      matches_per_night: parseInt(formData.get('matches_per_night') as string) || 5,
      best_of: parseInt(formData.get('best_of') as string) || 3,
      play_days: playDays,
      frequency: (formData.get('frequency') as string) || 'weekly',
      position_nights: parseInt(formData.get('position_nights') as string) || 2,
      position_night_placement: (formData.get('position_night_placement') as string) || 'half',
      bye_points: (formData.get('bye_points') as string) || 'win',
      times_to_play: parseInt(formData.get('times_to_play') as string) || 2,
    })
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}

// ─── Venues ───

export async function createVenue(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const name = formData.get('name') as string;
  const address = formData.get('address') as string || null;

  if (!name) return { error: 'Venue name is required' };

  const { error } = await supabase
    .from('venues')
    .insert({ org_id: orgId, name, address });

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}

export async function updateVenue(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const address = formData.get('address') as string || null;

  if (!id || !name) return { error: 'Venue name is required' };

  const { error } = await supabase
    .from('venues')
    .update({ name, address })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}

export async function deleteVenue(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'Venue ID is required' };

  const { error } = await supabase
    .from('venues')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}

// ─── Seasons ───

export async function createSeason(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const name = formData.get('name') as string;
  if (!name) return { error: 'Season name is required' };

  const { error } = await supabase
    .from('seasons')
    .insert({
      org_id: orgId,
      name,
      status: 'active',
    });

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}

export async function updateSeason(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const status = formData.get('status') as string;

  if (!id || !name) return { error: 'Season name is required' };

  const updates: Record<string, unknown> = { name };
  if (status) updates.status = status;

  const startDate = formData.get('start_date') as string;
  const endDate = formData.get('end_date') as string;
  if (startDate) updates.start_date = startDate;
  if (endDate) updates.end_date = endDate;

  const { error } = await supabase
    .from('seasons')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}

export async function archiveSeason(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'Season ID is required' };

  const { error } = await supabase
    .from('seasons')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}
