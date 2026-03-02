-- ============================================
-- INDEXES for score submission workflow
-- ============================================
CREATE INDEX idx_submissions_team_schedule ON submissions(team_id, schedule_id);
CREATE UNIQUE INDEX idx_matches_schedule_unique ON matches(schedule_id);

-- ============================================
-- RLS: Captain can delete own submission (withdraw)
-- ============================================
CREATE POLICY "submissions_delete_own" ON submissions FOR DELETE USING (
  org_id = auth_org_id()
  AND submitted_by = auth_profile_id()
);

-- ============================================
-- RPC: submit_scores
-- Captain submits scores; auto-verifies if both teams agree
-- ============================================
CREATE OR REPLACE FUNCTION submit_scores(
  p_org_id uuid,
  p_season_id uuid,
  p_schedule_id uuid,
  p_team_id uuid,
  p_submitted_by uuid,
  p_home_score integer,
  p_away_score integer,
  p_matchups jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule schedule%ROWTYPE;
  v_other_sub submissions%ROWTYPE;
  v_new_sub_id uuid;
  v_match_id uuid;
BEGIN
  -- 1. Verify the schedule entry exists and belongs to this org/season
  SELECT * INTO v_schedule
  FROM schedule
  WHERE id = p_schedule_id
    AND org_id = p_org_id
    AND season_id = p_season_id;

  IF v_schedule.id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Schedule entry not found');
  END IF;

  -- 2. Verify team is part of this match (home or away)
  IF v_schedule.home_team_id::text != p_team_id::text
    AND v_schedule.away_team_id::text != p_team_id::text THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Team is not part of this match');
  END IF;

  -- 3. Check no existing match for this schedule entry
  IF EXISTS (SELECT 1 FROM matches WHERE schedule_id = p_schedule_id) THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  -- 4. Check no duplicate submission from this team
  IF EXISTS (
    SELECT 1 FROM submissions
    WHERE schedule_id = p_schedule_id AND team_id = p_team_id
  ) THEN
    RETURN jsonb_build_object('status', 'already_submitted');
  END IF;

  -- 5. Insert the submission
  INSERT INTO submissions (org_id, season_id, schedule_id, team_id, submitted_by, home_score, away_score, matchups)
  VALUES (p_org_id, p_season_id, p_schedule_id, p_team_id, p_submitted_by, p_home_score, p_away_score, p_matchups)
  RETURNING id INTO v_new_sub_id;

  -- 6. Check for the other team's submission
  SELECT * INTO v_other_sub
  FROM submissions
  WHERE schedule_id = p_schedule_id
    AND team_id != p_team_id;

  -- 7. No other submission yet
  IF v_other_sub.id IS NULL THEN
    RETURN jsonb_build_object('status', 'pending', 'submission_id', v_new_sub_id);
  END IF;

  -- 8. Other submission exists — compare match-level scores
  IF v_other_sub.home_score = p_home_score AND v_other_sub.away_score = p_away_score THEN
    -- Scores match: auto-approve
    INSERT INTO matches (org_id, season_id, schedule_id, home_score, away_score, matchups, approved, marked_played)
    VALUES (p_org_id, p_season_id, p_schedule_id, p_home_score, p_away_score, p_matchups, true, true)
    RETURNING id INTO v_match_id;

    -- Delete both submissions
    DELETE FROM submissions WHERE schedule_id = p_schedule_id;

    RETURN jsonb_build_object('status', 'auto_approved', 'match_id', v_match_id);
  ELSE
    -- Scores conflict
    RETURN jsonb_build_object('status', 'conflict', 'submission_id', v_new_sub_id);
  END IF;
END;
$$;

-- ============================================
-- RPC: admin_approve_submission
-- Admin picks one submission to be the official result
-- ============================================
CREATE OR REPLACE FUNCTION admin_approve_submission(
  p_org_id uuid,
  p_schedule_id uuid,
  p_submission_id uuid,
  p_approved_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub submissions%ROWTYPE;
  v_match_id uuid;
BEGIN
  -- Get the chosen submission
  SELECT * INTO v_sub
  FROM submissions
  WHERE id = p_submission_id
    AND schedule_id = p_schedule_id
    AND org_id = p_org_id;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Submission not found');
  END IF;

  -- Check no match already exists
  IF EXISTS (SELECT 1 FROM matches WHERE schedule_id = p_schedule_id) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Match already exists');
  END IF;

  -- Create match from the chosen submission
  INSERT INTO matches (org_id, season_id, schedule_id, home_score, away_score, matchups, approved, marked_played, approved_by)
  VALUES (v_sub.org_id, v_sub.season_id, v_sub.schedule_id, v_sub.home_score, v_sub.away_score, v_sub.matchups, true, true, p_approved_by)
  RETURNING id INTO v_match_id;

  -- Delete all submissions for this schedule entry
  DELETE FROM submissions WHERE schedule_id = p_schedule_id AND org_id = p_org_id;

  RETURN jsonb_build_object('status', 'approved', 'match_id', v_match_id);
END;
$$;

-- ============================================
-- RPC: admin_reject_submissions
-- Admin rejects all submissions for a match (teams resubmit)
-- ============================================
CREATE OR REPLACE FUNCTION admin_reject_submissions(
  p_org_id uuid,
  p_schedule_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM submissions
  WHERE schedule_id = p_schedule_id
    AND org_id = p_org_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('status', 'rejected', 'deleted_count', v_count);
END;
$$;
