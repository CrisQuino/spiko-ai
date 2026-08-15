-- Add total_tokens to the per-user aggregate so the admin "top users" panel
-- can show token consumption too. Appended at the end so CREATE OR REPLACE
-- keeps the existing column order valid.
CREATE OR REPLACE VIEW admin_top_users AS
SELECT lc.user_id,
       p.email,
       count(*)::integer AS lessons_count,
       COALESCE(sum(lc.total_cost), 0::numeric) AS total_cost,
       CASE
         WHEN count(*) > 0 THEN COALESCE(sum(lc.total_cost), 0::numeric) / count(*)::numeric
         ELSE 0::numeric
       END AS avg_cost_per_lesson,
       max(lc.completed_at) AS last_lesson_at,
       COALESCE(sum(lc.total_tokens), 0)::bigint AS total_tokens
FROM lesson_costs lc
LEFT JOIN profiles p ON p.id = lc.user_id
WHERE lc.completed_at IS NOT NULL
GROUP BY lc.user_id, p.email
ORDER BY count(*) DESC;
