-- Persist the practice language per lesson so the admin CEFR distribution can
-- be filtered by language (Global / EN / FR / PT).
ALTER TABLE lesson_costs ADD COLUMN IF NOT EXISTS language text;

-- Per-language CEFR distribution (rows the admin aggregates client-side into
-- Global or a single language). Old rows with no language fall under 'unknown'
-- and only show under Global.
CREATE OR REPLACE VIEW admin_cefr_by_language AS
SELECT COALESCE(language, 'unknown') AS language,
       cefr_overall AS level,
       count(*)::integer AS count
FROM lesson_costs
WHERE completed_at IS NOT NULL
  AND cefr_overall IS NOT NULL
GROUP BY COALESCE(language, 'unknown'), cefr_overall;
