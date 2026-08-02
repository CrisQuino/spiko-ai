-- Migration: Lesson Tracking & Cost Management
-- Created: 2025-01-01
-- Description: Sistema completo de tracking de lecciones con CEFR assessment y costos

-- ============================================================================
-- 1. LESSON COSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lesson_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID NOT NULL,
  scenario_type TEXT NOT NULL,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Token tracking
  total_tokens INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  
  -- Cost calculation (USD)
  input_cost DECIMAL(10, 6) DEFAULT 0,
  output_cost DECIMAL(10, 6) DEFAULT 0,
  total_cost DECIMAL(10, 6) DEFAULT 0,
  
  -- CEFR Assessment Levels (A1, A2, B1, B2, C1, C2)
  cefr_overall TEXT,
  pronunciation_level TEXT,
  fluency_level TEXT,
  vocabulary_level TEXT,
  grammar_level TEXT,
  interaction_level TEXT,
  comprehension_level TEXT,
  
  -- Detailed scores (0-100 for internal tracking)
  pronunciation_score INTEGER CHECK (pronunciation_score >= 0 AND pronunciation_score <= 100),
  fluency_score INTEGER CHECK (fluency_score >= 0 AND fluency_score <= 100),
  vocabulary_score INTEGER CHECK (vocabulary_score >= 0 AND vocabulary_score <= 100),
  grammar_score INTEGER CHECK (grammar_score >= 0 AND grammar_score <= 100),
  interaction_score INTEGER CHECK (interaction_score >= 0 AND interaction_score <= 100),
  comprehension_score INTEGER CHECK (comprehension_score >= 0 AND comprehension_score <= 100),
  
  -- Feedback
  quick_feedback JSONB DEFAULT '[]'::jsonb,
  final_feedback TEXT,
  
  -- Technical jargon usage
  technical_terms_used TEXT[],
  technical_accuracy_level TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX idx_lesson_costs_user ON lesson_costs(user_id);
CREATE INDEX idx_lesson_costs_completed ON lesson_costs(completed_at DESC);
CREATE INDEX idx_lesson_costs_cost ON lesson_costs(total_cost DESC);
CREATE INDEX idx_lesson_costs_scenario ON lesson_costs(scenario_type);
CREATE INDEX idx_lesson_costs_created ON lesson_costs(created_at DESC);

-- ============================================================================
-- 2. USER PROGRESS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Overall stats
  total_lessons INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  lessons_this_month INTEGER DEFAULT 0,
  
  -- CEFR progression
  current_cefr_level TEXT DEFAULT 'A2',
  pronunciation_level TEXT DEFAULT 'A2',
  fluency_level TEXT DEFAULT 'A2',
  vocabulary_level TEXT DEFAULT 'A2',
  grammar_level TEXT DEFAULT 'A2',
  interaction_level TEXT DEFAULT 'A2',
  
  -- Historical tracking
  cefr_history JSONB DEFAULT '[]'::jsonb,
  
  -- Costs
  total_cost_usd DECIMAL(10, 2) DEFAULT 0,
  avg_cost_per_lesson DECIMAL(10, 6) DEFAULT 0,
  
  -- Last activity
  last_lesson_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_level ON user_progress(current_cefr_level);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE lesson_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Policies for lesson_costs
CREATE POLICY "Users can view own lesson costs"
  ON lesson_costs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson costs"
  ON lesson_costs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lesson costs"
  ON lesson_costs FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin policy (replace with your actual admin email)
CREATE POLICY "Admin can view all lesson costs"
  ON lesson_costs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'dash.crs@gmail.com'
    )
  );

-- Policies for user_progress
CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all progress"
  ON user_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'dash.crs@gmail.com'
    )
  );

-- ============================================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update user_progress when lesson completes
CREATE OR REPLACE FUNCTION update_user_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user_progress
  INSERT INTO user_progress (user_id, total_lessons, total_duration_minutes, total_cost_usd, last_lesson_at)
  VALUES (
    NEW.user_id,
    1,
    COALESCE(NEW.duration_seconds, 0) / 60,
    NEW.total_cost,
    NEW.completed_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_lessons = user_progress.total_lessons + 1,
    total_duration_minutes = user_progress.total_duration_minutes + (COALESCE(NEW.duration_seconds, 0) / 60),
    total_cost_usd = user_progress.total_cost_usd + NEW.total_cost,
    avg_cost_per_lesson = (user_progress.total_cost_usd + NEW.total_cost) / (user_progress.total_lessons + 1),
    current_cefr_level = COALESCE(NEW.cefr_overall, user_progress.current_cefr_level),
    pronunciation_level = COALESCE(NEW.pronunciation_level, user_progress.pronunciation_level),
    fluency_level = COALESCE(NEW.fluency_level, user_progress.fluency_level),
    vocabulary_level = COALESCE(NEW.vocabulary_level, user_progress.vocabulary_level),
    grammar_level = COALESCE(NEW.grammar_level, user_progress.grammar_level),
    interaction_level = COALESCE(NEW.interaction_level, user_progress.interaction_level),
    last_lesson_at = NEW.completed_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on lesson completion
CREATE TRIGGER trigger_update_user_progress
  AFTER INSERT OR UPDATE OF completed_at ON lesson_costs
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION update_user_progress();

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lesson_costs_updated_at
  BEFORE UPDATE ON lesson_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. ADMIN VIEWS (For Dashboard Queries)
-- ============================================================================

-- Daily cost summary
CREATE OR REPLACE VIEW admin_daily_costs AS
SELECT 
  DATE(completed_at) as date,
  COUNT(*) as lessons_count,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(total_tokens) as total_tokens,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(total_cost) as total_cost,
  AVG(total_cost) as avg_cost_per_lesson,
  AVG(duration_seconds) as avg_duration_seconds
FROM lesson_costs
WHERE completed_at IS NOT NULL
GROUP BY DATE(completed_at)
ORDER BY date DESC;

-- Monthly summary
CREATE OR REPLACE VIEW admin_monthly_costs AS
SELECT 
  DATE_TRUNC('month', completed_at) as month,
  COUNT(*) as lessons_count,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost) as total_cost,
  AVG(total_cost) as avg_cost_per_lesson
FROM lesson_costs
WHERE completed_at IS NOT NULL
GROUP BY DATE_TRUNC('month', completed_at)
ORDER BY month DESC;

-- Top users by consumption
CREATE OR REPLACE VIEW admin_top_users AS
SELECT 
  lc.user_id,
  u.email,
  COUNT(*) as lessons_count,
  SUM(lc.total_cost) as total_cost,
  AVG(lc.total_cost) as avg_cost_per_lesson,
  MAX(lc.completed_at) as last_lesson_at
FROM lesson_costs lc
JOIN auth.users u ON u.id = lc.user_id
WHERE lc.completed_at IS NOT NULL
GROUP BY lc.user_id, u.email
ORDER BY total_cost DESC
LIMIT 50;

-- CEFR distribution
CREATE OR REPLACE VIEW admin_cefr_distribution AS
SELECT 
  cefr_overall as level,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM lesson_costs
WHERE cefr_overall IS NOT NULL
GROUP BY cefr_overall
ORDER BY 
  CASE cefr_overall
    WHEN 'A1' THEN 1
    WHEN 'A2' THEN 2
    WHEN 'B1' THEN 3
    WHEN 'B2' THEN 4
    WHEN 'C1' THEN 5
    WHEN 'C2' THEN 6
  END;

-- ============================================================================
-- 6. INITIAL DATA (Optional)
-- ============================================================================

-- Insert sample admin user progress (if needed)
-- INSERT INTO user_progress (user_id, current_cefr_level)
-- SELECT id, 'C2' FROM auth.users WHERE email = 'kriz@ejemplo.com'
-- ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE lesson_costs IS 'Tracks individual lesson sessions with CEFR assessment and cost data';
COMMENT ON TABLE user_progress IS 'Aggregated user progress and CEFR levels over time';
COMMENT ON VIEW admin_daily_costs IS 'Daily infrastructure cost summary for admin dashboard';
COMMENT ON VIEW admin_monthly_costs IS 'Monthly infrastructure cost summary for admin dashboard';
COMMENT ON VIEW admin_top_users IS 'Top users by API consumption for admin monitoring';
COMMENT ON VIEW admin_cefr_distribution IS 'Distribution of CEFR levels across all lessons';
