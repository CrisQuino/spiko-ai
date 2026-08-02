-- Migration: Team Stats Integration
-- Created: 2025-01-01
-- Description: Conectar lesson_costs con company stats para Team Dashboard

-- ============================================================================
-- 1. ADD company_id TO lesson_costs
-- ============================================================================

ALTER TABLE lesson_costs 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_lesson_costs_company_id ON lesson_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_lesson_costs_created_at ON lesson_costs(started_at);

-- ============================================================================
-- 2. FUNCTION: Update profile stats after lesson completion
-- ============================================================================

CREATE OR REPLACE FUNCTION update_profile_stats_on_lesson_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update when lesson is completed
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE profiles
    SET 
      total_sessions = COALESCE(total_sessions, 0) + 1,
      last_session_at = NEW.completed_at
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TRIGGER: Auto-update profile stats
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_profile_stats ON lesson_costs;

CREATE TRIGGER trigger_update_profile_stats
  AFTER UPDATE ON lesson_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_on_lesson_complete();

-- ============================================================================
-- 4. FUNCTION: Sync company_id when lesson is created
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_lesson_company_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get company_id from user's profile
  SELECT company_id INTO NEW.company_id
  FROM profiles
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. TRIGGER: Auto-set company_id on lesson insert
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_lesson_company ON lesson_costs;

CREATE TRIGGER trigger_sync_lesson_company
  BEFORE INSERT ON lesson_costs
  FOR EACH ROW
  EXECUTE FUNCTION sync_lesson_company_id();

-- ============================================================================
-- 6. VIEW: Company stats with real lesson data
-- ============================================================================

CREATE OR REPLACE VIEW company_stats_view AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  
  -- Member counts
  COUNT(DISTINCT p.id) as total_employees,
  COUNT(DISTINCT CASE WHEN p.role = 'manager' THEN p.id END) as total_managers,
  
  -- Lesson stats (this month)
  COUNT(DISTINCT CASE 
    WHEN lc.completed_at >= date_trunc('month', CURRENT_DATE) 
    THEN lc.id 
  END) as lessons_this_month,
  
  -- Lesson stats (today)
  COUNT(DISTINCT CASE 
    WHEN DATE(lc.completed_at) = CURRENT_DATE 
    THEN lc.id 
  END) as lessons_today,
  
  -- Lesson stats (all time)
  COUNT(DISTINCT lc.id) as total_lessons,
  
  -- Average CEFR scores (only completed lessons)
  AVG(CASE WHEN lc.completed_at IS NOT NULL THEN 
    (lc.pronunciation_score + lc.fluency_score + lc.vocabulary_score + 
     lc.grammar_score + lc.interaction_score + lc.comprehension_score) / 6.0
  END) as avg_score,
  
  -- Active users (had a session this month)
  COUNT(DISTINCT CASE 
    WHEN lc.completed_at >= date_trunc('month', CURRENT_DATE) 
    THEN lc.user_id 
  END) as active_users_this_month

FROM companies c
LEFT JOIN profiles p ON p.company_id = c.id
LEFT JOIN lesson_costs lc ON lc.user_id = p.id AND lc.completed_at IS NOT NULL
GROUP BY c.id, c.name;

-- ============================================================================
-- 7. FUNCTION: Get company stats (for use in API)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_stats(p_company_id UUID)
RETURNS TABLE (
  total_employees BIGINT,
  total_managers BIGINT,
  lessons_this_month BIGINT,
  lessons_today BIGINT,
  total_lessons BIGINT,
  avg_score NUMERIC,
  active_users_this_month BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    csv.total_employees,
    csv.total_managers,
    csv.lessons_this_month,
    csv.lessons_today,
    csv.total_lessons,
    ROUND(csv.avg_score::numeric, 2) as avg_score,
    csv.active_users_this_month
  FROM company_stats_view csv
  WHERE csv.company_id = p_company_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Backfill existing lesson_costs with company_id
-- ============================================================================

UPDATE lesson_costs lc
SET company_id = p.company_id
FROM profiles p
WHERE lc.user_id = p.id AND lc.company_id IS NULL;

-- ============================================================================
-- 9. Grant permissions
-- ============================================================================

-- Allow authenticated users to read their company stats
GRANT SELECT ON company_stats_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_stats(UUID) TO authenticated;

COMMENT ON TABLE lesson_costs IS 'Tracking de lecciones con CEFR assessment, costos y company_id para team stats';
COMMENT ON COLUMN lesson_costs.company_id IS 'Company del usuario - auto-sync desde profile';
COMMENT ON VIEW company_stats_view IS 'Stats en tiempo real de companies basado en lesson_costs';
COMMENT ON FUNCTION get_company_stats IS 'Obtener stats de company para Team Dashboard';
