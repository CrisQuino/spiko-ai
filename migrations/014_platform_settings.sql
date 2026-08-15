-- Super-admin-editable platform settings (single row). The practice gate reads
-- these at request time, so changing a limit takes effect immediately for the
-- next session start — no env var, no redeploy.
CREATE TABLE IF NOT EXISTS platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  free_monthly_sessions integer NOT NULL DEFAULT 10,
  free_max_jds integer NOT NULL DEFAULT 3,
  premium_max_jds integer NOT NULL DEFAULT 25,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);

INSERT INTO platform_settings (id, free_monthly_sessions, free_max_jds, premium_max_jds)
VALUES (1, 3, 3, 25)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read the current limits (needed by the gate).
DROP POLICY IF EXISTS ps_read ON platform_settings;
CREATE POLICY ps_read ON platform_settings FOR SELECT USING (true);

-- Only the super-admin can change them.
DROP POLICY IF EXISTS ps_write ON platform_settings;
CREATE POLICY ps_write ON platform_settings FOR UPDATE
  USING ((auth.jwt() ->> 'email') = 'dash.crs@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'dash.crs@gmail.com');
