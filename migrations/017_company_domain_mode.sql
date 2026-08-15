-- Company invite-domain policy. Instead of free-text, a company either accepts
-- ANY email domain, or auto-follows its MANAGER's email domain (so promoting a
-- manager sets the filter, and it tracks manager changes). allowed_email_domain
-- holds the concrete value used at invite time; domain_mode records the intent.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS domain_mode text NOT NULL DEFAULT 'any'
  CHECK (domain_mode IN ('any', 'manager'));

-- Existing companies that already carry a concrete domain are treated as
-- 'manager' mode (their domain was derived from a manager); the rest stay 'any'.
UPDATE companies SET domain_mode = 'manager' WHERE allowed_email_domain IS NOT NULL;
