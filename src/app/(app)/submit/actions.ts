'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validateMatchups, type MatchupInput } from '@/lib/validation/score-validation';
import { notifyScoreSubmitted, notifyAdminConflict, notifyBothTeamsApproved } from '@/lib/email/notifications';

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

  // Fire email notifications asynchronously (don't block response)
  sendScoreNotifications(supabase, auth, data, status, validation.homeScore, validation.awayScore).catch(() => {});

  return { error: null, status };
}

async function sendScoreNotifications(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  auth: { profileId: string; orgId: string },
  data: { scheduleId: string; teamId: string; seasonId: string },
  status: string,
  homeScore: number,
  awayScore: number,
) {
  // Get schedule entry for week/team info
  const { data: sched } = await supabase
    .from('schedule')
    .select('week, home_team_id, away_team_id')
    .eq('id', data.scheduleId)
    .single();
  if (!sched) return;

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, captain_profile_id')
    .in('id', [sched.home_team_id, sched.away_team_id]);
  if (!teams || teams.length < 2) return;

  const homeTeam = teams.find(t => t.id === sched.home_team_id);
  const awayTeam = teams.find(t => t.id === sched.away_team_id);
  if (!homeTeam || !awayTeam) return;

  // Get submitter's profile
  const { data: submitter } = await supabase
    .from('profiles')
    .select('email, display_name')
    .eq('id', auth.profileId)
    .single();
  if (!submitter?.email) return;

  // Notify submitting captain
  const mappedStatus = status === 'pending' ? 'pending' : status === 'auto_approved' ? 'auto_approved' : 'conflict';
  await notifyScoreSubmitted({
    captainEmail: submitter.email,
    captainName: submitter.display_name || 'Captain',
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    week: sched.week,
    status: mappedStatus as 'pending' | 'auto_approved' | 'conflict',
  });

  // If auto-approved, notify both captains
  if (status === 'auto_approved') {
    const captainIds = [homeTeam.captain_profile_id, awayTeam.captain_profile_id].filter(Boolean);
    if (captainIds.length > 0) {
      const { data: captains } = await supabase
        .from('profiles')
        .select('email')
        .in('id', captainIds);
      const emails = (captains || []).map(c => c.email).filter(Boolean) as string[];
      if (emails.length > 0) {
        await notifyBothTeamsApproved({
          captainEmails: emails,
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore,
          awayScore,
          week: sched.week,
        });
      }
    }
  }

  // If conflict, notify admins
  if (status === 'conflict') {
    const { data: admins } = await supabase
      .from('memberships')
      .select('profile_id')
      .eq('org_id', auth.orgId)
      .eq('role', 'admin');
    if (admins && admins.length > 0) {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', admins.map(a => a.profile_id));
      const adminEmails = (adminProfiles || []).map(p => p.email).filter(Boolean) as string[];
      if (adminEmails.length > 0) {
        await notifyAdminConflict({
          adminEmails,
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          week: sched.week,
        });
      }
    }
  }
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
