-- Helper functions for RLS policies
-- These allow RLS policies to determine the current user's profile, org, and role

-- Get the authenticated user's profile ID
CREATE OR REPLACE FUNCTION auth_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$;

-- Get the authenticated user's current org_id
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM memberships
  WHERE profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  LIMIT 1
$$;

-- Get the authenticated user's role in their org
CREATE OR REPLACE FUNCTION auth_org_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM memberships
  WHERE profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  AND org_id = (
    SELECT org_id FROM memberships
    WHERE profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    LIMIT 1
  )
$$;

-- Check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE auth_user_id = auth.uid()),
    false
  )
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
