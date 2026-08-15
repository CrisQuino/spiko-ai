-- Phase 1: usage limits, account status/revocation, and JD visibility.

-- Company-level limits + status + domain (set by the super-admin per company).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS daily_practice_limit integer,
  ADD COLUMN IF NOT EXISTS monthly_practice_limit integer,
  ADD COLUMN IF NOT EXISTS max_jds_per_user integer,
  ADD COLUMN IF NOT EXISTS allowed_email_domain text,
  ADD COLUMN IF NOT EXISTS seats_used integer NOT NULL DEFAULT 0;

-- Account status (revocation) + plan.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- JD visibility: manager uploads are company-wide, member uploads are personal.
ALTER TABLE job_descriptions
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'personal';

-- Existing users already in a company are corporate.
UPDATE profiles SET plan = 'corporate' WHERE company_id IS NOT NULL AND plan = 'free';

-- Visibility-aware JD SELECT: own JDs, or company JDs explicitly shared with the team.
DROP POLICY IF EXISTS jd_select_own_or_company ON job_descriptions;
CREATE POLICY jd_select_own_or_company ON job_descriptions
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      company_id IS NOT NULL
      AND visibility = 'company'
      AND company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    )
  );

-- Let a user read their own company row (needed by the practice gate to read limits/status).
DROP POLICY IF EXISTS companies_select_own ON companies;
CREATE POLICY companies_select_own ON companies
  FOR SELECT USING (
    id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
  );
