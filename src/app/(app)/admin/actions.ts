'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validateMatchups, type MatchupInput } from '@/lib/validation/score-validation';

async function requireAdmin() {
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
  if (!membership || membership.role !== 'admin') return null;

  return { profileId: profile.id, orgId: membership.org_id };
}

export async function approveSubmission(data: {
  scheduleId: string;
  submissionId: string;
}): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Not authorized' };

  const supabase = createServerSupabaseClient();
  const { data: result, error } = await supabase.rpc('admin_approve_submission', {
    p_org_id: admin.orgId,
    p_schedule_id: data.scheduleId,
    p_submission_id: data.submissionId,
    p_approved_by: admin.profileId,
  });

  if (error) return { error: error.message };

  const status = (result as { status: string }).status;
  if (status === 'error') {
    return { error: (result as { message: string }).message };
  }

  revalidatePath('/admin');
  revalidatePath('/standings');
  revalidatePath('/submit');
  return { error: null };
}

export async function rejectSubmissions(data: {
  scheduleId: string;
}): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Not authorized' };

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc('admin_reject_submissions', {
    p_org_id: admin.orgId,
    p_schedule_id: data.scheduleId,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/submit');
  return { error: null };
}

export async function adminPostScores(data: {
  scheduleId: string;
  seasonId: string;
  matchups: MatchupInput[];
  matchesPerNight: number;
  bestOf: number;
}): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Not authorized' };

  const validation = validateMatchups(data.matchups, data.matchesPerNight, data.bestOf);
  if (!validation.valid) {
    return { error: validation.errors.join('. ') };
  }

  const supabase = createServerSupabaseClient();

  // Admin has INSERT permission on matches via RLS
  const { error: matchError } = await supabase
    .from('matches')
    .insert({
      org_id: admin.orgId,
      season_id: data.seasonId,
      schedule_id: data.scheduleId,
      home_score: validation.homeScore,
      away_score: validation.awayScore,
      matchups: data.matchups,
      approved: true,
      marked_played: true,
      approved_by: admin.profileId,
    });

  if (matchError) return { error: matchError.message };

  // Clean up any pending submissions for this match
  await supabase
    .from('submissions')
    .delete()
    .eq('schedule_id', data.scheduleId)
    .eq('org_id', admin.orgId);

  revalidatePath('/admin');
  revalidatePath('/standings');
  revalidatePath('/submit');
  return { error: null };
}

export async function processSmsScore(data: {
  smsId: string;
  action: 'approve' | 'reject';
  scheduleId?: string;
  seasonId?: string;
  teamId?: string;
  matchups?: MatchupInput[];
  matchesPerNight?: number;
  bestOf?: number;
}): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Not authorized' };

  const supabase = createServerSupabaseClient();

  if (data.action === 'reject') {
    const { error } = await supabase
      .from('sms_pending_scores')
      .update({
        status: 'failed',
        error_message: 'Rejected by admin',
        processed_at: new Date().toISOString(),
      })
      .eq('id', data.smsId)
      .eq('org_id', admin.orgId);

    if (error) return { error: error.message };
    revalidatePath('/admin');
    return { error: null };
  }

  // Approve: submit scores via RPC
  if (!data.matchups || !data.scheduleId || !data.seasonId || !data.teamId) {
    return { error: 'Missing required data for approval' };
  }

  const validation = validateMatchups(data.matchups, data.matchesPerNight || 5, data.bestOf || 3);
  if (!validation.valid) {
    return { error: validation.errors.join('. ') };
  }

  // Get the submitter's profile from the SMS record
  const { data: smsRecord } = await supabase
    .from('sms_pending_scores')
    .select('from_phone')
    .eq('id', data.smsId)
    .single();

  // Find profile by phone
  let submittedBy = admin.profileId;
  if (smsRecord?.from_phone) {
    const { data: captainProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', smsRecord.from_phone.replace(/[^\d+]/g, ''))
      .single();
    if (captainProfile) submittedBy = captainProfile.id;
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_scores', {
    p_org_id: admin.orgId,
    p_season_id: data.seasonId,
    p_schedule_id: data.scheduleId,
    p_team_id: data.teamId,
    p_submitted_by: submittedBy,
    p_home_score: validation.homeScore,
    p_away_score: validation.awayScore,
    p_matchups: data.matchups,
  });

  if (rpcError) return { error: rpcError.message };

  const status = (rpcResult as { status: string }).status;
  if (status === 'error') {
    return { error: (rpcResult as { message: string }).message };
  }

  // Mark SMS as processed
  await supabase
    .from('sms_pending_scores')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', data.smsId);

  revalidatePath('/admin');
  revalidatePath('/standings');
  revalidatePath('/submit');
  return { error: null };
}
