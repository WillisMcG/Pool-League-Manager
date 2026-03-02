'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ScheduleWeek } from '@/lib/schedule/round-robin';

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

export async function saveSchedule(seasonId: string, weeks: ScheduleWeek[]) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  // Delete existing schedule for this season
  const { error: deleteError } = await supabase
    .from('schedule')
    .delete()
    .eq('org_id', orgId)
    .eq('season_id', seasonId);

  if (deleteError) return { error: deleteError.message };

  // Flatten weeks into rows
  const rows = weeks.flatMap(week =>
    week.matches.map(match => ({
      org_id: orgId,
      season_id: seasonId,
      week: week.week,
      date: week.date,
      half: week.half,
      home_team_id: match.homeTeamId,
      away_team_id: match.awayTeamId,
      venue: match.venue,
      is_bye: match.isBye,
      is_position_night: match.isPositionNight,
      position_home: match.positionHome,
      position_away: match.positionAway,
    }))
  );

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from('schedule').insert(batch);
    if (error) return { error: error.message };
  }

  revalidatePath('/schedule');
  return { error: null };
}

export async function deleteSchedule(seasonId: string) {
  const supabase = createServerSupabaseClient();
  const orgId = await getOrgId();
  if (!orgId) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('schedule')
    .delete()
    .eq('org_id', orgId)
    .eq('season_id', seasonId);

  if (error) return { error: error.message };

  revalidatePath('/schedule');
  return { error: null };
}
