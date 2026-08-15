-- Persist the CEFR level the learner selected at session start (the "target"),
-- so the admin dashboard can compare it against the achieved cefr_overall.
ALTER TABLE lesson_costs ADD COLUMN IF NOT EXISTS target_level text;

-- Recreate the admin view exposing target_level (appended at the end so
-- CREATE OR REPLACE is valid — existing columns keep their order).
CREATE OR REPLACE VIEW admin_recent_lessons AS
SELECT lc.id,
       lc.lesson_id,
       lc.scenario_type,
       lc.scenario_title,
       lc.completed_at,
       lc.duration_seconds,
       lc.total_cost,
       lc.total_tokens,
       lc.cefr_overall,
       lc.user_id,
       p.email,
       p.full_name,
       lc.target_level
FROM lesson_costs lc
LEFT JOIN profiles p ON p.id = lc.user_id
WHERE lc.completed_at IS NOT NULL
ORDER BY lc.completed_at DESC;
