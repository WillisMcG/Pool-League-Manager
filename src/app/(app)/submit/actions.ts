'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validateMatchups, type MatchupInput } from '@/lib/validation/score-validation';

async function getAuth() {
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
    .select('org_id, role')
    .eq('profile_id', profile.id)
    .single();
  if (!membership) return null;

  return { profileId: profile.id, orgId: membership.org_id, role: membership.role };
}

export async function submitScores(data: {
  scheduleId: string;
  teamId: string;
  seasonId: string;
  matchups: MatchupInput[];
  matchesPerNight: number;
  bestOf: number;
}): Promise<{ error: string | null; status?: string }> {
  const auth = await getAuth();
  if (!auth) return { error: 'Not authenticated' };

  // Validate matchups
  const validation = validateMatchups(data.matchups, data.matchesPerNight, data.bestOf);
  if (!validation.valid) {
    return { error: validation.errors.join('. ') };
  }

  // Call the RPC
  const supabase = createServerSupabaseClient();
  const { data: result, error } = await supabase.rpc('submit_scores', {
    p_org_id: auth.orgId,
    p_season_id: data.seasonId,
    p_schedule_id: data.scheduleId,
    p_team_id: data.teamId,
    p_submitted_by: auth.profileId,
    p_home_score: validation.homeScore,
    p_away_score: validation.awayScore,
    p_matchups: data.matchups,
  });

  if (error) return { error: error.message };

  const status = (result as { status: string }).status;
  if (status === 'error') {
    return { error: (result as { message: string }).message };
  }

  revalidatePath('/submit');
  revalidatePath('/standings');
  revalidatePath('/admin');

  return { error: null, status };
}

export async function withdrawSubmission(submissionId: string): Promise<{ error: string | null }> {
  const auth = await getAuth();
  if (!auth) return { error: 'Not authenticated' };

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', submissionId)
    .eq('submitted_by', auth.profileId);

  if (error) return { error: error.message };

  revalidatePath('/submit');
  revalidatePath('/admin');
  return { error: null };
}
