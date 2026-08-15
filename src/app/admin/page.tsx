'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getKPIMetrics,
  getDailyCosts,
  getTopUsers,
  getCEFRByLanguage,
  getRecentLessons,
  type KPIMetrics,
  type DailyCost,
  type TopUser,
  type CEFRByLanguage,
} from '@/lib/admin-queries';

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<KPIMetrics | null>(null);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [cefrByLang, setCefrByLang] = useState<CEFRByLanguage[]>([]);
  const [cefrLangFilter, setCefrLangFilter] = useState<'global' | 'en' | 'fr' | 'pt'>('global');
  const [recentLessons, setRecentLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  async function checkAdminAndLoadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('🔐 Admin check - User:', user?.email || 'none');
      
      if (!user) {
        console.log('❌ No user found');
        setLoading(false);
        return;
      }
      
      setUserEmail(user.email || '');
      
      // Simple check: is email exactly dash.crs@gmail.com?
      const adminStatus = user.email === 'dash.crs@gmail.com';
      setIsAdmin(adminStatus);
      
      console.log('👤 User:', user.email);
      console.log('🔐 Is Admin:', adminStatus);
      
      if (!adminStatus) {
        console.log('❌ Not admin');
        setLoading(false);
        return;
      }
      
      console.log('✅ Admin confirmed, loading data...');
      
      // Load data only if admin
      await loadDashboardData();
    } catch (error) {
      console.error('Error checking admin:', error);
      setLoading(false);
    }
  }

  async function loadDashboardData() {
    try {
      const [kpiData, dailyData, usersData, cefrData, lessonsData] = await Promise.all([
        getKPIMetrics(),
        getDailyCosts(30),
        getTopUsers(200),
        getCEFRByLanguage(),
        getRecentLessons(20),
      ]);

      setKpis(kpiData);
      setDailyCosts(dailyData);
      setTopUsers(usersData);
      setCefrByLang(cefrData);
      setRecentLessons(lessonsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">// loading_admin_dashboard()</p>
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl p-12 max-w-md text-center border border-red-200">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold font-mono mb-2 text-gray-900">access.denied()</h2>
          <p className="text-gray-600 font-mono text-sm mb-4">
            <span className="text-red-600">// Admin access required</span>
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-xs font-mono text-gray-500">Your email:</p>
            <p className="font-mono text-sm text-gray-900 break-all">{userEmail || 'Not logged in'}</p>
            <p className="text-xs font-mono text-gray-500 mt-2">Required:</p>
            <p className="font-mono text-sm text-emerald-600">dash.crs@gmail.com</p>
          </div>
          
          {!userEmail && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800 font-mono">
                ⚠️ You're not logged in. Please sign in first.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-mono transition-all"
            >
              🔄 Refresh Page
            </button>
            
            <a
              href="/dashboard"
              className="block px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-mono hover:shadow-xl transition-all"
            >
              ← back_to_dashboard()
            </a>
            
            {!userEmail && (
              <a
                href="/auth/login"
                className="block px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-mono transition-all"
              >
                🔑 Sign In
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">// loading_data()</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold font-mono gradient-text mb-2">
          admin.dashboard()
        </h1>
        <p className="text-gray-600 font-mono text-sm">
          // Infrastructure metrics and cost tracking
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Cost (Month)"
          value={`$${kpis.totalCostMonth.toFixed(2)}`}
          subtitle={`${kpis.totalLessonsMonth} lessons`}
          icon="💰"
          trend={kpis.totalCostMonth > 0 ? 'up' : 'neutral'}
        />
        <KPICard
          title="Active Users"
          value={kpis.activeUsers.toString()}
          subtitle="This month"
          icon="👥"
          trend="up"
        />
        <KPICard
          title="Lessons Today"
          value={kpis.lessonsToday.toString()}
          subtitle={new Date().toLocaleDateString()}
          icon="📚"
          trend="neutral"
        />
        <KPICard
          title="Avg Cost/Lesson"
          value={`$${kpis.avgCostPerLesson.toFixed(4)}`}
          subtitle={`${(kpis.totalTokensMonth / 1000).toFixed(0)}k tokens`}
          icon="📊"
          trend="down"
        />
      </div>

      {/* Daily Costs Chart */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <h2 className="text-xl font-bold font-mono mb-4">
          <span className="text-gray-400">// </span>daily_costs()
        </h2>
        
        <div className="overflow-x-auto">
          <div className="min-w-[600px] h-64 flex items-end space-x-2">
            {dailyCosts.slice(0, 30).reverse().map((day, i) => {
              const maxCost = Math.max(...dailyCosts.map(d => d.total_cost));
              const height = maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0;
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 to-cyan-500 rounded-t hover:from-emerald-600 hover:to-cyan-600 transition-all cursor-pointer min-h-[2px]"
                    style={{ height: `${height}%` }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap font-mono z-10">
                      ${day.total_cost.toFixed(2)}<br/>
                      {day.lessons_count} lessons<br/>
                      {new Date(day.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2 font-mono">
                    {new Date(day.date).getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <div className="glass rounded-2xl p-6 border border-gray-200/50">
          <h2 className="text-xl font-bold font-mono mb-4">
            <span className="text-gray-400">// </span>top_users()
          </h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {topUsers.map((user, i) => (
              <div key={user.user_id} className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-mono text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-gray-800 truncate">{user.email}</p>
                    <p className="font-mono text-xs text-gray-500">
                      {user.lessons_count} lessons · {Number(user.total_tokens || 0).toLocaleString()} tok
                      {user.last_lesson_at ? ` · ${new Date(user.last_lesson_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <p className="font-mono text-sm font-bold text-emerald-600">
                    ${Number(user.total_cost || 0).toFixed(2)}
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    ${(Number(user.total_cost || 0) / (user.lessons_count || 1)).toFixed(4)}/lesson
                  </p>
                </div>
              </div>
            ))}

            {topUsers.length === 0 && (
              <p className="text-center text-gray-500 font-mono text-sm py-8">
                // no_data_yet
              </p>
            )}
          </div>
        </div>

        {/* CEFR Distribution */}
        <div className="glass rounded-2xl p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-mono">
              <span className="text-gray-400">// </span>cefr_distribution()
            </h2>
            <div className="flex gap-1">
              {(['global', 'en', 'fr', 'pt'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setCefrLangFilter(opt)}
                  className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
                    cefrLangFilter === opt
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                      : 'bg-white/60 text-gray-600 hover:bg-white'
                  }`}
                >
                  {opt === 'global' ? 'Global' : opt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const rows =
              cefrLangFilter === 'global'
                ? cefrByLang
                : cefrByLang.filter((r) => r.language === cefrLangFilter);
            const counts: Record<string, number> = {};
            let total = 0;
            rows.forEach((r) => {
              counts[r.level] = (counts[r.level] || 0) + r.count;
              total += r.count;
            });

            return (
              <div className="space-y-3">
                {['C2', 'C1', 'B2', 'B1', 'A2', 'A1'].map((level) => {
                  const count = counts[level] || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;

                  return (
                    <div key={level}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-bold text-gray-700">{level}</span>
                        <span className="font-mono text-sm text-gray-600">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}

                {total === 0 && (
                  <p className="text-center text-gray-500 font-mono text-sm py-8">
                    // no_assessments_yet{cefrLangFilter !== 'global' ? ` for ${cefrLangFilter.toUpperCase()}` : ''}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Recent Lessons Table */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <h2 className="text-xl font-bold font-mono mb-4">
          <span className="text-gray-400">// </span>recent_lessons()
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">User</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Scenario</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Duration</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">CEFR</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Tokens</th>
                <th className="text-right py-3 px-4 font-mono text-sm text-gray-600">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentLessons.map((lesson) => (
                <tr key={lesson.id} className="border-b border-gray-200 hover:bg-white/50">
                  <td className="py-3 px-4 font-mono text-sm">
                    {new Date(lesson.completed_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-700">
                    {lesson.email || lesson.full_name || (lesson.user_id ? `${lesson.user_id.slice(0, 8)}…` : '—')}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/session/${lesson.lesson_id}`}
                      className="tech-badge-emerald text-xs hover:underline"
                      title="Review this session"
                    >
                      {lesson.scenario_title || lesson.scenario_type} →
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-600">
                    {Math.floor((lesson.duration_seconds || 0) / 60)}:{String((lesson.duration_seconds || 0) % 60).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-4">
                    {lesson.cefr_overall && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="tech-badge-cyan text-xs">
                          {lesson.cefr_overall}
                        </span>
                        {(() => {
                          const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                          const t = order.indexOf(lesson.target_level);
                          const o = order.indexOf(lesson.cefr_overall);
                          if (t < 0 || o < 0) return null;
                          if (o === t)
                            return (
                              <span className="text-blue-500" title={`Target ${lesson.target_level} — met`} aria-label="meets target">
                                ●
                              </span>
                            );
                          if (o > t)
                            return (
                              <span className="text-green-600" title={`Target ${lesson.target_level} — above target`} aria-label="above target">
                                ▲
                              </span>
                            );
                          return (
                            <span className="text-red-600" title={`Target ${lesson.target_level} — below target`} aria-label="below target">
                              ▼
                            </span>
                          );
                        })()}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-600">
                    {(lesson.total_tokens || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-right font-bold text-emerald-600">
                    ${(lesson.total_cost || 0).toFixed(4)}
                  </td>
                </tr>
              ))}
              
              {recentLessons.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-mono text-sm">
                    // no_lessons_yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend 
}: { 
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  trend: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="glass rounded-xl p-6 border border-gray-200/50 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        <div className={`text-xs font-mono ${trendColors[trend]}`}>
          {trend === 'up' && '↗'}
          {trend === 'down' && '↘'}
          {trend === 'neutral' && '→'}
        </div>
      </div>
      
      <div className="mb-1">
        <p className="text-2xl font-bold font-mono gradient-text">{value}</p>
      </div>
      
      <p className="text-sm font-mono text-gray-600 mb-1">{title}</p>
      <p className="text-xs font-mono text-gray-500">{subtitle}</p>
    </div>
  );
}
