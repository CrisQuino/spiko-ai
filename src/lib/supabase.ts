import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// TYPES
// ============================================

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'employee' | 'manager' | 'admin';
  company_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'team' | 'enterprise';
  max_users: number;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  company_id: string | null;
  scenario_id: string;
  scenario_title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  role: 'dba' | 'devops' | 'network';
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  progress: number;
  english_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  overall_score: number | null;
  language: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  audio_url: string | null;
  created_at: string;
};

export type VocabularyUsage = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  word: string;
  context: string | null;
  category: 'technical' | 'general' | 'advanced';
  first_used_at: string;
  times_used: number;
  created_at: string;
};

export type JobDescription = {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  
  return data;
}

export async function getCompany(companyId: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();
  
  if (error) {
    console.error('Error fetching company:', error);
    return null;
  }
  
  return data;
}

// Practice sessions are persisted in `lesson_costs` (that is what the lesson
// start/complete API writes). Map those rows onto the Conversation shape the
// dashboard expects so stats and history reflect real activity.
function mapLessonToConversation(l: any): Conversation {
  const completed = !!l.completed_at;
  const dims = [
    l.pronunciation_score,
    l.fluency_score,
    l.vocabulary_score,
    l.grammar_score,
    l.interaction_score,
    l.comprehension_score,
  ].filter((n: unknown): n is number => typeof n === 'number');
  const overall =
    completed && dims.length > 0
      ? Math.round(dims.reduce((a, b) => a + b, 0) / dims.length)
      : null;

  return {
    id: l.id,
    user_id: l.user_id,
    company_id: null,
    scenario_id: l.lesson_id,
    scenario_title:
      l.scenario_title ||
      (l.scenario_type ? l.scenario_type.charAt(0).toUpperCase() + l.scenario_type.slice(1) : 'Practice'),
    difficulty: 'medium',
    role: 'dba',
    started_at: l.started_at,
    completed_at: l.completed_at,
    duration_seconds: l.duration_seconds,
    status: completed ? 'completed' : 'in_progress',
    progress: completed ? 100 : 0,
    english_score: null,
    technical_score: null,
    communication_score: null,
    overall_score: overall,
    language: l.language || 'unknown',
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

export type TranscriptMessage = { role: 'user' | 'ai'; content: string; timestamp?: number };

export type LessonDetail = {
  lesson_id: string;
  user_id: string;
  scenario_type: string | null;
  scenario_title: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  total_tokens: number | null;
  total_cost: number | null;
  cefr_overall: string | null;
  pronunciation_level: string | null; pronunciation_score: number | null;
  fluency_level: string | null; fluency_score: number | null;
  vocabulary_level: string | null; vocabulary_score: number | null;
  grammar_level: string | null; grammar_score: number | null;
  interaction_level: string | null; interaction_score: number | null;
  comprehension_level: string | null; comprehension_score: number | null;
  technical_accuracy_level: string | null;
  technical_terms_used: string[] | null;
  quick_feedback: string[] | null;
  final_feedback: string | null;
  transcript: TranscriptMessage[] | null;
};

// Fetch a single practice session by its lesson_id (RLS: own sessions, plus all
// for admins). Used by the session-detail page.
export async function getLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  const { data, error } = await supabase
    .from('lesson_costs')
    .select('*')
    .eq('lesson_id', lessonId)
    .single();

  if (error) {
    console.error('Error fetching lesson detail:', error);
    return null;
  }
  return data as LessonDetail;
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('lesson_costs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  return (data || []).map(mapLessonToConversation);
}

// Minimal per-session rows (own sessions via RLS) for the CEFR target-vs-assessed
// trend chart on the individual dashboard.
export type CefrLesson = { completed_at: string; language: string; target_level: string | null; cefr_overall: string | null };
export async function getUserCefrLessons(userId: string): Promise<CefrLesson[]> {
  const { data, error } = await supabase
    .from('lesson_costs')
    .select('completed_at, language, target_level, cefr_overall')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });
  if (error) { console.error('Error fetching CEFR lessons:', error); return []; }
  return (data || []) as CefrLesson[];
}

export async function getCompanyConversations(companyId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('company_id', companyId)
    .order('started_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching company conversations:', error);
    return [];
  }
  
  return data;
}

export async function getCompanyEmployees(companyId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', companyId)
    .order('full_name', { ascending: true });
  
  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
  
  return data;
}

// ============================================
// JOB DESCRIPTIONS
// ============================================

// Returns the JDs visible to the current user (own + company), newest first.
// Visibility is enforced by RLS; this just orders the result.
export async function getJobDescriptions(): Promise<JobDescription[]> {
  const { data, error } = await supabase
    .from('job_descriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching job descriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * How many JDs the current user has vs their cap (for the upload limit).
 * Caps come from super-admin platform_settings (live) / the company row — no env.
 */
export async function getJdQuota(): Promise<{ used: number; cap: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { used: 0, cap: 0 };
  const { count } = await supabase
    .from('job_descriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const used = count || 0;
  const { data: profile } = await supabase.from('profiles').select('plan, company_id').eq('id', user.id).single();
  const { data: settings } = await supabase.from('platform_settings').select('free_max_jds, premium_max_jds').eq('id', 1).single();
  const freeMax = settings?.free_max_jds ?? 3;
  const premiumMax = settings?.premium_max_jds ?? 25;
  let cap = freeMax;
  if (profile?.company_id) {
    const { data: company } = await supabase.from('companies').select('max_jds_per_user').eq('id', profile.company_id).single();
    cap = (company?.max_jds_per_user ?? null) == null ? Number.MAX_SAFE_INTEGER : company!.max_jds_per_user;
  } else if (profile?.plan === 'premium') {
    cap = premiumMax;
  }
  return { used, cap };
}

export async function createJobDescription(input: {
  title: string;
  content: string;
  companyId?: string | null;
}): Promise<JobDescription | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('Cannot create job description: no authenticated user');
    return null;
  }

  const { data, error } = await supabase
    .from('job_descriptions')
    .insert({
      user_id: user.id,
      company_id: input.companyId ?? null,
      title: input.title.trim(),
      content: input.content.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating job description:', error);
    return null;
  }

  return data;
}

export async function getJobDescription(id: string): Promise<JobDescription | null> {
  const { data, error } = await supabase
    .from('job_descriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching job description:', error);
    return null;
  }

  return data;
}

// ============================================
// ANALYTICS HELPERS
// ============================================

export type UserStats = {
  totalConversations: number;
  completedConversations: number;
  averageScore: number;
  totalTimeMinutes: number;
  lastActivity: string | null;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const conversations = await getUserConversations(userId);
  
  const completed = conversations.filter(c => c.status === 'completed');
  
  const totalScore = completed.reduce((sum, c) => sum + (c.overall_score || 0), 0);
  const avgScore = completed.length > 0 ? Math.round(totalScore / completed.length) : 0;
  
  const totalTime = conversations.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const totalMinutes = Math.round(totalTime / 60);
  
  const lastActivity = conversations.length > 0 ? conversations[0].started_at : null;
  
  return {
    totalConversations: conversations.length,
    completedConversations: completed.length,
    averageScore: avgScore,
    totalTimeMinutes: totalMinutes,
    lastActivity
  };
}

export type CompanyStats = {
  totalEmployees: number;
  activeThisMonth: number;
  totalConversations: number;
  averageScore: number;
  topPerformers: Array<{ profile: Profile; stats: UserStats }>;
  total_sessions?: number;
  lessons_today?: number;
};

export async function getCompanyStats(companyId: string): Promise<CompanyStats> {
  // Use the new SQL function for optimized stats
  const { data, error } = await supabase
    .rpc('get_company_stats', { p_company_id: companyId });
  
  if (error) {
    console.error('Error fetching company stats:', error);
    // Fallback to manual calculation
    return await getCompanyStatsManual(companyId);
  }
  
  const stats = data[0] || {
    total_employees: 0,
    lessons_this_month: 0,
    lessons_today: 0,
    total_lessons: 0,
    avg_score: 0,
    active_users_this_month: 0
  };
  
  // Get top performers separately
  const employees = await getCompanyEmployees(companyId);
  const employeeStats = await Promise.all(
    employees.map(async (employee) => ({
      profile: employee,
      stats: await getUserStats(employee.id)
    }))
  );
  
  const topPerformers = employeeStats
    .filter(e => e.stats.completedConversations > 0)
    .sort((a, b) => b.stats.averageScore - a.stats.averageScore)
    .slice(0, 5);
  
  return {
    totalEmployees: stats.total_employees,
    activeThisMonth: stats.active_users_this_month,
    totalConversations: stats.total_lessons,
    averageScore: Math.round(stats.avg_score || 0),
    topPerformers,
    total_sessions: stats.total_lessons,
    lessons_today: stats.lessons_today
  };
}

// Fallback manual calculation if SQL function fails
async function getCompanyStatsManual(companyId: string): Promise<CompanyStats> {
  const employees = await getCompanyEmployees(companyId);
  const conversations = await getCompanyConversations(companyId);
  
  // Active this month
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const activeEmployees = new Set(
    conversations
      .filter(c => new Date(c.started_at) > oneMonthAgo)
      .map(c => c.user_id)
  );
  
  // Average score
  const completed = conversations.filter(c => c.status === 'completed' && c.overall_score);
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, c) => sum + c.overall_score!, 0) / completed.length)
    : 0;
  
  // Top performers
  const employeeStats = await Promise.all(
    employees.map(async (employee) => ({
      profile: employee,
      stats: await getUserStats(employee.id)
    }))
  );
  
  const topPerformers = employeeStats
    .filter(e => e.stats.completedConversations > 0)
    .sort((a, b) => b.stats.averageScore - a.stats.averageScore)
    .slice(0, 5);
  
  return {
    totalEmployees: employees.length,
    activeThisMonth: activeEmployees.size,
    totalConversations: conversations.length,
    averageScore: avgScore,
    topPerformers,
    total_sessions: conversations.length,
    lessons_today: 0
  };
}
