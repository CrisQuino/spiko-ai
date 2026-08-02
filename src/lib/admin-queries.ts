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
}

export interface CEFRDistribution {
  level: string;
  count: number;
  percentage: number;
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
 * Calculate KPI metrics for dashboard
 */
export async function getKPIMetrics(): Promise<KPIMetrics> {
  // Get current month data
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { data: monthData } = await supabase
    .from('lesson_costs')
    .select('total_cost, user_id, total_tokens')
    .gte('completed_at', firstDayOfMonth.toISOString())
    .not('completed_at', 'is', null);

  // Get today's data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todayData } = await supabase
    .from('lesson_costs')
    .select('*')
    .gte('completed_at', today.toISOString())
    .not('completed_at', 'is', null);

  const totalCostMonth = monthData?.reduce((sum, item) => sum + Number(item.total_cost), 0) || 0;
  const activeUsers = new Set(monthData?.map(item => item.user_id) || []).size;
  const lessonsToday = todayData?.length || 0;
  const totalLessonsMonth = monthData?.length || 0;
  const avgCostPerLesson = totalLessonsMonth > 0 ? totalCostMonth / totalLessonsMonth : 0;
  const totalTokensMonth = monthData?.reduce((sum, item) => sum + (item.total_tokens || 0), 0) || 0;

  return {
    totalCostMonth: Number(totalCostMonth.toFixed(2)),
    activeUsers,
    lessonsToday,
    avgCostPerLesson: Number(avgCostPerLesson.toFixed(4)),
    totalLessonsMonth,
    totalTokensMonth,
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
  const { data, error } = await supabase
    .from('lesson_costs')
    .select(`
      id,
      lesson_id,
      scenario_type,
      completed_at,
      duration_seconds,
      total_cost,
      total_tokens,
      cefr_overall,
      user_id
    `)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent lessons:', error);
    return [];
  }

  return data || [];
}
