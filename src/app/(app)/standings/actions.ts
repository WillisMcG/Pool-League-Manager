'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

export async function addStandingsAdjustment(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const seasonId = formData.get('season_id') as string;
  const teamId = formData.get('team_id') as string;
  const winsAdj = parseInt(formData.get('wins_adj') as string) || 0;
  const lossesAdj = parseInt(formData.get('losses_adj') as string) || 0;
  const gamesWonAdj = parseInt(formData.get('games_won_adj') as string) || 0;
  const gamesLostAdj = parseInt(formData.get('games_lost_adj') as string) || 0;
  const reason = formData.get('reason') as string || null;

  if (!seasonId || !teamId) return { error: 'Season and team are required' };

  const { error } = await supabase
    .from('standings_adjustments')
    .insert({
      org_id: orgId,
      season_id: seasonId,
      team_id: teamId,
      wins_adj: winsAdj,
      losses_adj: lossesAdj,
      games_won_adj: gamesWonAdj,
      games_lost_adj: gamesLostAdj,
      reason,
    });

  if (error) return { error: error.message };

  revalidatePath('/standings');
  return { error: null };
}

export async function deleteStandingsAdjustment(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'Adjustment ID is required' };

  const { error } = await supabase
    .from('standings_adjustments')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/standings');
  return { error: null };
}
