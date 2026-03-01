-- ============================================
-- SIGNUP: Create org with admin user
-- Called after supabase.auth.signUp() succeeds
-- ============================================
CREATE OR REPLACE FUNCTION create_org_with_admin(
  p_auth_user_id uuid,
  p_email text,
  p_name text,
  p_phone text,
  p_org_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_season_id uuid;
  v_slug text;
BEGIN
  -- Generate slug from org name
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  -- Handle slug collision
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || extract(epoch from now())::integer;
  END IF;

  -- Create profile
  INSERT INTO profiles (auth_user_id, email, name, phone)
  VALUES (p_auth_user_id, p_email, p_name, p_phone)
  RETURNING id INTO v_profile_id;

  -- Create organization
  INSERT INTO organizations (name, slug)
  VALUES (p_org_name, v_slug)
  RETURNING id INTO v_org_id;

  -- Create membership as admin
  INSERT INTO memberships (profile_id, org_id, role)
  VALUES (v_profile_id, v_org_id, 'admin');

  -- Create default league settings
  INSERT INTO league_settings (org_id)
  VALUES (v_org_id);

  -- Create default season
  INSERT INTO seasons (org_id, name, status)
  VALUES (v_org_id, 'Season 1', 'active')
  RETURNING id INTO v_season_id;

  RETURN jsonb_build_object(
    'profile_id', v_profile_id,
    'org_id', v_org_id,
    'season_id', v_season_id,
    'slug', v_slug
  );
END;
$$;

-- ============================================
-- ADD MEMBER: Invite a user to an org
-- Called by admin to add captain/player
-- ============================================
CREATE OR REPLACE FUNCTION add_org_member(
  p_email text,
  p_name text,
  p_phone text,
  p_org_id uuid,
  p_role text DEFAULT 'player'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_membership_id uuid;
BEGIN
  -- Check if profile already exists by email
  SELECT * INTO v_profile FROM profiles WHERE email = p_email;

  IF v_profile.id IS NULL THEN
    -- No profile yet — they'll need to sign up.
    -- For now, return indication that invite should be sent.
    RETURN jsonb_build_object(
      'status', 'invite_needed',
      'email', p_email
    );
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM memberships WHERE profile_id = v_profile.id AND org_id = p_org_id) THEN
    RETURN jsonb_build_object(
      'status', 'already_member',
      'profile_id', v_profile.id
    );
  END IF;

  -- Add membership
  INSERT INTO memberships (profile_id, org_id, role)
  VALUES (v_profile.id, p_org_id, p_role)
  RETURNING id INTO v_membership_id;

  RETURN jsonb_build_object(
    'status', 'added',
    'profile_id', v_profile.id,
    'membership_id', v_membership_id
  );
END;
$$;
