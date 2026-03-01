-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_pending_scores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth_user_id = auth.uid()
  OR id IN (SELECT profile_id FROM memberships WHERE org_id = auth_org_id())
  OR is_super_admin()
);

CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  auth_user_id = auth.uid()
);

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE POLICY "orgs_select" ON organizations FOR SELECT USING (
  id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "orgs_update" ON organizations FOR UPDATE USING (
  (id = auth_org_id() AND auth_org_role() = 'admin')
  OR is_super_admin()
);

-- ============================================
-- MEMBERSHIPS
-- ============================================
CREATE POLICY "memberships_select" ON memberships FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "memberships_insert" ON memberships FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "memberships_update" ON memberships FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "memberships_delete" ON memberships FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- LEAGUE SETTINGS
-- ============================================
CREATE POLICY "league_settings_select" ON league_settings FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "league_settings_update" ON league_settings FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- SEASONS
-- ============================================
CREATE POLICY "seasons_select" ON seasons FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "seasons_insert" ON seasons FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "seasons_update" ON seasons FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "seasons_delete" ON seasons FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- VENUES
-- ============================================
CREATE POLICY "venues_select" ON venues FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "venues_insert" ON venues FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "venues_update" ON venues FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "venues_delete" ON venues FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- TEAMS
-- ============================================
CREATE POLICY "teams_select" ON teams FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "teams_update" ON teams FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() IN ('admin', 'captain')
);

CREATE POLICY "teams_delete" ON teams FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- PLAYERS
-- ============================================
CREATE POLICY "players_select" ON players FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() IN ('admin', 'captain')
);

CREATE POLICY "players_update" ON players FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() IN ('admin', 'captain')
);

CREATE POLICY "players_delete" ON players FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- SCHEDULE
-- ============================================
CREATE POLICY "schedule_select" ON schedule FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "schedule_insert" ON schedule FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "schedule_update" ON schedule FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "schedule_delete" ON schedule FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- SUBMISSIONS
-- ============================================
CREATE POLICY "submissions_select" ON submissions FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "submissions_insert" ON submissions FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() IN ('admin', 'captain')
);

CREATE POLICY "submissions_delete" ON submissions FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- MATCHES
-- ============================================
CREATE POLICY "matches_select" ON matches FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "matches_update" ON matches FOR UPDATE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "matches_delete" ON matches FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- STANDINGS ADJUSTMENTS
-- ============================================
CREATE POLICY "standings_adj_select" ON standings_adjustments FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "standings_adj_insert" ON standings_adjustments FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "standings_adj_delete" ON standings_adjustments FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- PLAYER STATS ADJUSTMENTS
-- ============================================
CREATE POLICY "player_stats_adj_select" ON player_stats_adjustments FOR SELECT USING (
  org_id = auth_org_id() OR is_super_admin()
);

CREATE POLICY "player_stats_adj_insert" ON player_stats_adjustments FOR INSERT WITH CHECK (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

CREATE POLICY "player_stats_adj_delete" ON player_stats_adjustments FOR DELETE USING (
  org_id = auth_org_id() AND auth_org_role() = 'admin'
);

-- ============================================
-- AUDIT LOG (append-only for authenticated, read for admins)
-- ============================================
CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (
  (org_id = auth_org_id() AND auth_org_role() = 'admin')
  OR is_super_admin()
);

-- ============================================
-- SMS PENDING SCORES (service role insert, admin read)
-- ============================================
CREATE POLICY "sms_select" ON sms_pending_scores FOR SELECT USING (
  (org_id = auth_org_id() AND auth_org_role() = 'admin')
  OR is_super_admin()
);

CREATE POLICY "sms_update" ON sms_pending_scores FOR UPDATE USING (
  (org_id = auth_org_id() AND auth_org_role() = 'admin')
  OR is_super_admin()
);
