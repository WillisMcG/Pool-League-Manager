-- Phase 4: Schema updates for OCR, Stripe, SMS features

-- Add tracking columns to sms_pending_scores
ALTER TABLE sms_pending_scores
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES schedule(id),
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Add subscription_status to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing','active','past_due','canceled','expired'));

-- Indexes for SMS queue queries
CREATE INDEX IF NOT EXISTS idx_sms_pending_status ON sms_pending_scores(status);
CREATE INDEX IF NOT EXISTS idx_sms_pending_org ON sms_pending_scores(org_id);

-- RLS for sms_pending_scores: admins can read/update their org's entries
ALTER TABLE sms_pending_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_pending_select_admin" ON sms_pending_scores
  FOR SELECT USING (org_id = auth_org_id() AND auth_org_role() = 'admin');

CREATE POLICY "sms_pending_update_admin" ON sms_pending_scores
  FOR UPDATE USING (org_id = auth_org_id() AND auth_org_role() = 'admin');
