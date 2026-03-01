-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  phone text,
  avatar_url text,
  is_super_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  subscription_tier text DEFAULT 'trial'
    CHECK (subscription_tier IN ('trial', 'basic', 'pro', 'premium')),
  subscription_status text DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at timestamptz DEFAULT now() + interval '14 days',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- MEMBERSHIPS
-- ============================================
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'player'
    CHECK (role IN ('admin', 'captain', 'player')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, org_id)
);

-- ============================================
-- LEAGUE SETTINGS
-- ============================================
CREATE TABLE league_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  matches_per_night integer DEFAULT 5,
  best_of integer DEFAULT 3,
  play_days integer[] DEFAULT '{2}',
  frequency text DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'biweekly')),
  position_nights integer DEFAULT 2,
  position_night_placement text DEFAULT 'half'
    CHECK (position_night_placement IN ('half', 'end', 'start')),
  bye_points text DEFAULT 'win'
    CHECK (bye_points IN ('win', 'none')),
  times_to_play integer DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER league_settings_updated_at
  BEFORE UPDATE ON league_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEASONS
-- ============================================
CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- VENUES
-- ============================================
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- TEAMS
-- ============================================
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  captain_profile_id uuid REFERENCES profiles(id),
  venue text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PLAYERS
-- ============================================
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  is_sub boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- SCHEDULE
-- ============================================
CREATE TABLE schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week integer NOT NULL,
  date date NOT NULL,
  home_team_id text NOT NULL,
  away_team_id text NOT NULL,
  venue text,
  half integer DEFAULT 1,
  is_bye boolean DEFAULT false,
  is_position_night boolean DEFAULT false,
  position_home integer,
  position_away integer,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- SUBMISSIONS (dual-submission workflow)
-- ============================================
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id),
  schedule_id uuid NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id),
  submitted_by uuid NOT NULL REFERENCES profiles(id),
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  matchups jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- MATCHES (approved results)
-- ============================================
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id),
  schedule_id uuid NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  matchups jsonb NOT NULL DEFAULT '[]',
  approved boolean DEFAULT true,
  marked_played boolean DEFAULT false,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- STANDINGS ADJUSTMENTS
-- ============================================
CREATE TABLE standings_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id),
  team_id uuid NOT NULL REFERENCES teams(id),
  wins_adj integer DEFAULT 0,
  losses_adj integer DEFAULT 0,
  games_won_adj integer DEFAULT 0,
  games_lost_adj integer DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PLAYER STATS ADJUSTMENTS
-- ============================================
CREATE TABLE player_stats_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id),
  player_id uuid NOT NULL REFERENCES players(id),
  match_wins_adj integer DEFAULT 0,
  match_losses_adj integer DEFAULT 0,
  games_won_adj integer DEFAULT 0,
  games_lost_adj integer DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  profile_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- SMS PENDING SCORES
-- ============================================
CREATE TABLE sms_pending_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  from_phone text NOT NULL,
  body text,
  media_url text,
  parsed_data jsonb,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_memberships_profile ON memberships(profile_id);
CREATE INDEX idx_memberships_org ON memberships(org_id);
CREATE INDEX idx_seasons_org ON seasons(org_id);
CREATE INDEX idx_teams_org_season ON teams(org_id, season_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_schedule_season ON schedule(season_id);
CREATE INDEX idx_schedule_org ON schedule(org_id);
CREATE INDEX idx_submissions_schedule ON submissions(schedule_id);
CREATE INDEX idx_matches_schedule ON matches(schedule_id);
CREATE INDEX idx_matches_season ON matches(season_id);
