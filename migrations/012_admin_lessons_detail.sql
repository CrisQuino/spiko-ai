-- Single per-lesson dataset the admin dashboard derives ALL panels/KPIs from,
-- so one language filter + date range can drive everything client-side.
-- Postgres-owned view → bypasses the per-user RLS on lesson_costs.
CREATE OR REPLACE VIEW admin_lessons_detail AS
SELECT lc.lesson_id,
       lc.user_id,
       p.email,
       lc.completed_at,
       COALESCE(lc.language, 'unknown') AS language,
       COALESCE(lc.total_cost, 0::numeric) AS total_cost,
       COALESCE(lc.total_tokens, 0) AS total_tokens,
       lc.cefr_overall,
       lc.target_level,
       lc.duration_seconds,
       lc.scenario_title
FROM lesson_costs lc
LEFT JOIN profiles p ON p.id = lc.user_id
WHERE lc.completed_at IS NOT NULL;
