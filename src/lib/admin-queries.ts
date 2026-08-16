// Admin Dashboard Queries
// Only accessible to admin users

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export interface DailyCost {
  date: string;
  lessons_count: number;
  unique_users: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  avg_cost_per_lesson: number;
  avg_duration_seconds: number;
}

export interface MonthlyCost {
  month: string;
  lessons_count: number;
  unique_users: number;
  total_tokens: number;
  total_cost: number;
  avg_cost_per_lesson: number;
}

export interface TopUser {
  user_id: string;
  email: string;
  lessons_count: number;
  total_cost: number;
  avg_cost_per_lesson: number;
  last_lesson_at: string;
  total_tokens: number;
}

export interface CEFRDistribution {
  level: string;
  count: number;
  percentage: number;
}

export interface CEFRByLanguage {
  language: string; // 'en' | 'fr' | 'pt' | 'unknown'
  level: string;
  count: number;
}

export interface AdminLesson {
  lesson_id: string;
  user_id: string;
  email: string | null;
  completed_at: string;
  language: string; // 'en' | 'fr' | 'pt' | 'unknown'
  total_cost: number;
  total_tokens: number;
  cefr_overall: string | null;
  target_level: string | null;
  duration_seconds: number | null;
  scenario_title: string | null;
  company_id: string | null;
  company_name: string | null;
}

/**
 * Fetch every completed lesson (admin-only, bypasses RLS via the postgres-owned
 * admin_lessons_detail view). The admin dashboard computes ALL panels/KPIs from
 * this single dataset so one language filter + date range drives everything.
 */
export async function getAdminLessons(): Promise<AdminLesson[]> {
  const { data, error } = await supabase
    .from('admin_lessons_detail')
    .select('*')
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin lessons:', error);
    return [];
  }
  return (data || []) as AdminLesson[];
}

export interface KPIMetrics {
  totalCostMonth: number;
  activeUsers: number;
  lessonsToday: number;
  avgCostPerLesson: number;
  totalLessonsMonth: number;
  totalTokensMonth: number;
}

/**
 * Fetch daily costs for the last N days
 */
export async function getDailyCosts(days: number = 30): Promise<DailyCost[]> {
  const { data, error } = await supabase
    .from('admin_daily_costs')
    .select('*')
    .limit(days)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching daily costs:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch monthly summary for the last N months
 */
export async function getMonthlySummary(months: number = 12): Promise<MonthlyCost[]> {
  const { data, error } = await supabase
    .from('admin_monthly_costs')
    .select('*')
    .limit(months)
    .order('month', { ascending: false });

  if (error) {
    console.error('Error fetching monthly costs:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch top users by consumption
 */
export async function getTopUsers(limit: number = 50): Promise<TopUser[]> {
  const { data, error } = await supabase
    .from('admin_top_users')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching top users:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch CEFR level distribution
 */
export async function getCEFRDistribution(): Promise<CEFRDistribution[]> {
  const { data, error } = await supabase
    .from('admin_cefr_distribution')
    .select('*');

  if (error) {
    console.error('Error fetching CEFR distribution:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch CEFR distribution split by practice language (for the Global/EN/FR/PT
 * selector). The admin page aggregates these rows client-side.
 */
export async function getCEFRByLanguage(): Promise<CEFRByLanguage[]> {
  const { data, error } = await supabase
    .from('admin_cefr_by_language')
    .select('*');

  if (error) {
    console.error('Error fetching CEFR by language:', error);
    return [];
  }

  return data || [];
}

/**
 * Calculate KPI metrics for dashboard
 */
export async function getKPIMetrics(): Promise<KPIMetrics> {
  // Read from the admin aggregate views (owned by postgres → they see ALL
  // users, bypassing the per-user RLS on lesson_costs).
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const { data: monthly } = await supabase.from('admin_monthly_costs').select('*');
  const m: any = (monthly || []).find((r: any) => r.month === currentMonth);

  const { data: daily } = await supabase.from('admin_daily_costs').select('*');
  const d: any = (daily || []).find((r: any) => String(r.date).startsWith(todayStr));

  const totalCostMonth = Number(m?.total_cost || 0);

  return {
    totalCostMonth: Number(totalCostMonth.toFixed(4)),
    activeUsers: Number(m?.unique_users || 0),
    lessonsToday: Number(d?.lessons_count || 0),
    avgCostPerLesson: Number(Number(m?.avg_cost_per_lesson || 0).toFixed(6)),
    totalLessonsMonth: Number(m?.lessons_count || 0),
    totalTokensMonth: Number(m?.total_tokens || 0),
  };
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  // Admin email - solo este usuario puede acceder al dashboard
  const ADMIN_EMAIL = 'dash.crs@gmail.com';
  
  return user.email === ADMIN_EMAIL;
}

/**
 * Get recent lessons with details
 */
export async function getRecentLessons(limit: number = 20) {
  // admin_recent_lessons is a postgres-owned view (bypasses RLS) that joins the
  // user's email/name, so the admin sees every user's sessions.
  const { data, error } = await supabase
    .from('admin_recent_lessons')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching recent lessons:', error);
    return [];
  }

  return data || [];
}
