export interface Profile {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_tier: 'free' | 'trial' | 'basic' | 'pro' | 'premium';
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  trial_ends_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export type OrgRole = 'admin' | 'captain' | 'player';

export interface Membership {
  id: string;
  profile_id: string;
  org_id: string;
  role: OrgRole;
  created_at: string;
  // Joined fields
  profile?: Profile;
  organization?: Organization;
}

export interface LeagueSettings {
  id: string;
  org_id: string;
  matches_per_night: number;
  best_of: number;
  play_days: number[];
  frequency: 'weekly' | 'biweekly';
  position_nights: number;
  position_night_placement: 'half' | 'end' | 'start';
  bye_points: 'win' | 'none';
  times_to_play: number;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  org_id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  season_id: string;
  name: string;
  captain_profile_id: string | null;
  venue: string | null;
  created_at: string;
  // Joined fields
  players?: Player[];
  captain?: Profile;
}

export interface Player {
  id: string;
  org_id: string;
  team_id: string;
  profile_id: string | null;
  name: string;
  is_sub: boolean;
  created_at: string;
  // Joined fields
  team?: Team;
}

export interface Venue {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface ScheduleEntry {
  id: string;
  org_id: string;
  season_id: string;
  week: number;
  date: string;
  home_team_id: string;
  away_team_id: string;
  venue: string | null;
  half: number;
  is_bye: boolean;
  is_position_night: boolean;
  position_home: number | null;
  position_away: number | null;
  created_at: string;
  // Joined fields
  home_team?: Team;
  away_team?: Team;
}

export interface Matchup {
  home_player: string;
  away_player: string;
  home_wins: number;
  away_wins: number;
}

export interface Submission {
  id: string;
  org_id: string;
  season_id: string;
  schedule_id: string;
  team_id: string;
  submitted_by: string;
  home_score: number;
  away_score: number;
  matchups: Matchup[];
  created_at: string;
  // Joined fields
  team?: Team;
  submitter?: Profile;
  schedule_entry?: ScheduleEntry;
}

export interface Match {
  id: string;
  org_id: string;
  season_id: string;
  schedule_id: string;
  home_score: number;
  away_score: number;
  matchups: Matchup[];
  approved: boolean;
  marked_played: boolean;
  approved_by: string | null;
  created_at: string;
  // Joined fields
  schedule_entry?: ScheduleEntry;
}

export interface StandingsAdjustment {
  id: string;
  org_id: string;
  season_id: string;
  team_id: string;
  wins_adj: number;
  losses_adj: number;
  games_won_adj: number;
  games_lost_adj: number;
  reason: string | null;
  created_at: string;
}

export interface PlayerStatsAdjustment {
  id: string;
  org_id: string;
  season_id: string;
  player_id: string;
  match_wins_adj: number;
  match_losses_adj: number;
  games_won_adj: number;
  games_lost_adj: number;
  reason: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  org_id: string | null;
  profile_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SmsPendingScore {
  id: string;
  org_id: string | null;
  from_phone: string;
  body: string | null;
  media_url: string | null;
  parsed_data: Record<string, unknown> | null;
  status: 'pending' | 'processed' | 'failed';
  error_message: string | null;
  schedule_id: string | null;
  team_id: string | null;
  processed_at: string | null;
  created_at: string;
}

// Computed types (not stored, calculated from data)
export interface TeamStanding {
  team: Team;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  matchPct: number;
  gamePct: number;
  rank: number;
}

export interface PlayerStats {
  player: Player;
  matchWins: number;
  matchLosses: number;
  gamesWon: number;
  gamesLost: number;
  matchPct: number;
  gamePct: number;
}
