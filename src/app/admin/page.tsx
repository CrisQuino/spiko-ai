'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAdminLessons, type AdminLesson } from '@/lib/admin-queries';

type Lang = 'global' | 'en' | 'fr' | 'pt';
type Granularity = 'day' | 'month';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (s: string) => {
  const d = new Date(s);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthKey = (s: string) => {
  const d = new Date(s);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export default function AdminDashboard() {
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Global filters — drive every panel and KPI.
  const [lang, setLang] = useState<Lang>('global');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string | null } | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  async function checkAdminAndLoadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserEmail(user.email || '');
      const adminStatus = user.email === 'dash.crs@gmail.com';
      setIsAdmin(adminStatus);
      if (!adminStatus) {
        setLoading(false);
        return;
      }
      const data = await getAdminLessons();
      setLessons(data);
    } catch (error) {
      console.error('Error checking admin:', error);
    } finally {
      setLoading(false);
    }
  }

  // Language-filtered dataset that every panel derives from.
  const langLessons = useMemo(
    () => (lang === 'global' ? lessons : lessons.filter((l) => l.language === lang)),
    [lessons, lang]
  );

  // KPIs (month / today scope, on the language-filtered set).
  const kpis = useMemo(() => {
    const now = new Date();
    const mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const tk = `${mk}-${pad(now.getDate())}`;
    const month = langLessons.filter((l) => monthKey(l.completed_at) === mk);
    const cost = month.reduce((s, l) => s + Number(l.total_cost || 0), 0);
    const tokens = month.reduce((s, l) => s + Number(l.total_tokens || 0), 0);
    const users = new Set(month.map((l) => l.user_id)).size;
    const today = langLessons.filter((l) => dayKey(l.completed_at) === tk).length;
    return { cost, lessons: month.length, users, avg: month.length ? cost / month.length : 0, tokens, today };
  }, [langLessons]);

  // API cost series (by day or month, within the selected date range).
  const series = useMemo(() => {
    const inRange = (s: string) => {
      const k = dayKey(s);
      return (!rangeStart || k >= rangeStart) && (!rangeEnd || k <= rangeEnd);
    };
    const buckets: Record<string, { key: string; cost: number; lessons: number; tokens: number; userSet: Set<string> }> = {};
    langLessons
      .filter((l) => inRange(l.completed_at))
      .forEach((l) => {
        const key = granularity === 'day' ? dayKey(l.completed_at) : monthKey(l.completed_at);
        if (!buckets[key]) buckets[key] = { key, cost: 0, lessons: 0, tokens: 0, userSet: new Set() };
        buckets[key].cost += Number(l.total_cost || 0);
        buckets[key].lessons += 1;
        buckets[key].tokens += Number(l.total_tokens || 0);
        buckets[key].userSet.add(l.user_id);
      });
    return Object.values(buckets)
      .map((b) => ({ key: b.key, cost: b.cost, lessons: b.lessons, tokens: b.tokens, users: b.userSet.size }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [langLessons, granularity, rangeStart, rangeEnd]);

  const maxCost = useMemo(() => Math.max(0, ...series.map((s) => s.cost)), [series]);
  const rangeTotal = useMemo(() => series.reduce((s, b) => s + b.cost, 0), [series]);
  // Axis maxima with ~18% headroom so on-bar/point value labels never clip.
  const costAxis = useMemo(() => (maxCost > 0 ? maxCost * 1.18 : 1), [maxCost]);
  const lessonsAxis = useMemo(() => Math.max(1, Math.ceil(Math.max(1, ...series.map((s) => s.lessons)) * 1.18)), [series]);
  const usersAxis = useMemo(() => Math.max(1, Math.ceil(Math.max(1, ...series.map((s) => s.users)) * 1.18)), [series]);
  // X position with side padding so edge points/values don't collide with the Y axes.
  const xAt = (i: number) => (series.length > 1 ? 8 + (i / (series.length - 1)) * 84 : 50);

  // Per-user aggregate.
  const users = useMemo(() => {
    const m: Record<string, { user_id: string; email: string | null; lessons: number; cost: number; tokens: number; last: string }> = {};
    langLessons.forEach((l) => {
      const k = l.user_id;
      if (!m[k]) m[k] = { user_id: k, email: l.email, lessons: 0, cost: 0, tokens: 0, last: l.completed_at };
      m[k].lessons += 1;
      m[k].cost += Number(l.total_cost || 0);
      m[k].tokens += Number(l.total_tokens || 0);
      if (l.completed_at > m[k].last) m[k].last = l.completed_at;
    });
    return Object.values(m).sort((a, b) => b.cost - a.cost);
  }, [langLessons]);

  // Selecting a user scopes CEFR distribution + recent lessons to that user
  // (KPIs, costs, activity and top_users stay on the full set).
  const scoped = useMemo(
    () => (selectedUser ? langLessons.filter((l) => l.user_id === selectedUser.id) : langLessons),
    [langLessons, selectedUser]
  );

  // CEFR distribution (scoped to the selected user when one is picked).
  const cefr = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    scoped.forEach((l) => {
      if (l.cefr_overall) {
        counts[l.cefr_overall] = (counts[l.cefr_overall] || 0) + 1;
        total += 1;
      }
    });
    return { counts, total };
  }, [scoped]);

  // Recent lessons: all of a selected user's lessons, else the latest 20.
  const recent = useMemo(() => scoped.slice(0, selectedUser ? 100 : 20), [scoped, selectedUser]);

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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header + global language filter */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-mono gradient-text mb-2">admin.dashboard()</h1>
          <p className="text-gray-600 font-mono text-sm">// Infrastructure metrics and cost tracking</p>
        </div>
        <LangSelector value={lang} onChange={setLang} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Cost (Month)" value={`$${kpis.cost.toFixed(2)}`} subtitle={`${kpis.lessons} lessons`} icon="💰" trend={kpis.cost > 0 ? 'up' : 'neutral'} />
        <KPICard title="Active Users" value={kpis.users.toString()} subtitle="This month" icon="👥" trend="up" />
        <KPICard title="Lessons Today" value={kpis.today.toString()} subtitle={new Date().toLocaleDateString()} icon="📚" trend="neutral" />
        <KPICard title="Avg Cost/Lesson" value={`$${kpis.avg.toFixed(4)}`} subtitle={`${(kpis.tokens / 1000).toFixed(0)}k tokens`} icon="📊" trend="down" />
      </div>

      {/* API AI Costs */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 className="text-xl font-bold font-mono">
            <span className="text-gray-400">// </span>api_ai_costs()
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {(['day', 'month'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
                    granularity === g ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'
                  }`}
                >
                  {g === 'day' ? 'Days' : 'Months'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 font-mono text-xs text-gray-600">
              <input type="date" value={rangeStart} max={rangeEnd} onChange={(e) => setRangeStart(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
              <span>→</span>
              <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => setRangeEnd(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
            </div>
          </div>
        </div>

        <div className="font-mono text-sm text-gray-500 mb-3">
          Range total: <span className="font-bold text-emerald-600">${rangeTotal.toFixed(4)}</span> · {series.length} {granularity === 'day' ? 'day(s)' : 'month(s)'}
        </div>

        <div className="flex gap-3">
          {/* Y axis */}
          <div className="flex flex-col justify-between h-64 text-right text-xs font-mono text-gray-400 py-1 shrink-0 w-16">
            <span>${costAxis.toFixed(2)}</span>
            <span>${(costAxis / 2).toFixed(2)}</span>
            <span>$0.00</span>
          </div>
          {/* Bars */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[500px] h-64 flex items-end gap-1 border-l border-b border-gray-200 relative">
              {/* gridlines */}
              <div className="absolute left-0 right-0 top-0 border-t border-dashed border-gray-100"></div>
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-100"></div>
              {series.map((b) => {
                const h = costAxis > 0 ? (b.cost / costAxis) * 100 : 0;
                return (
                  <div key={b.key} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-cyan-500 rounded-t hover:from-emerald-600 hover:to-cyan-600 transition-all cursor-pointer min-h-[2px] relative"
                      style={{ height: `${h}%` }}
                    >
                      {/* value on top of each bar (horizontal, always visible thanks to axis headroom) */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] font-mono text-gray-600 whitespace-nowrap font-semibold">
                        ${b.cost.toFixed(3)}
                      </span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap font-mono z-10">
                        ${b.cost.toFixed(4)}<br />
                        {b.lessons} lessons · {b.users} users · {b.tokens.toLocaleString()} tok<br />
                        {b.key}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 font-mono truncate max-w-full">
                      {granularity === 'day' ? new Date(b.key).getUTCDate() : b.key.slice(2)}
                    </div>
                  </div>
                );
              })}
              {series.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm">
                  // no_data_in_range
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity: lessons + active users, dual Y axis, dots + per-point values */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 className="text-xl font-bold font-mono">
            <span className="text-gray-400">// </span>activity()
          </h2>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>lessons (left)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500"></span>active users (right)</span>
            <span className="text-gray-400">({granularity === 'day' ? 'per day' : 'per month'})</span>
          </div>
        </div>

        <div className="flex gap-2">
          {/* left Y axis — lessons */}
          <div className="flex flex-col justify-between h-56 text-right text-xs font-mono text-emerald-600 py-1 shrink-0 w-8">
            <span>{lessonsAxis}</span>
            <span>{Math.round(lessonsAxis / 2)}</span>
            <span>0</span>
          </div>

          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="relative h-56 border-l border-r border-b border-gray-200">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <line x1="0" y1="50" x2="100" y2="50" stroke="#f3f4f6" strokeWidth="0.5" />
                  {series.length > 1 && (
                    <>
                      <polyline fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke"
                        points={series.map((s, i) => `${xAt(i)},${100 - (s.lessons / lessonsAxis) * 100}`).join(' ')} />
                      <polyline fill="none" stroke="#06b6d4" strokeWidth="2" vectorEffect="non-scaling-stroke"
                        points={series.map((s, i) => `${xAt(i)},${100 - (s.users / usersAxis) * 100}`).join(' ')} />
                    </>
                  )}
                </svg>
                {/* dots + values (HTML so circles don't distort) */}
                {series.map((s, i) => {
                  const x = xAt(i);
                  const yl = 100 - (s.lessons / lessonsAxis) * 100;
                  const yu = 100 - (s.users / usersAxis) * 100;
                  return (
                    <div key={s.key}>
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow" style={{ left: `${x}%`, top: `${yl}%`, transform: 'translate(-50%,-50%)' }} title={`${s.lessons} lessons`} />
                      <span className="absolute text-[10px] font-mono font-bold text-emerald-700 whitespace-nowrap" style={{ left: `${x}%`, top: `${yl}%`, transform: 'translate(-50%,-170%)' }}>{s.lessons}</span>
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-white shadow" style={{ left: `${x}%`, top: `${yu}%`, transform: 'translate(-50%,-50%)' }} title={`${s.users} active users`} />
                      <span className="absolute text-[10px] font-mono font-bold text-cyan-700 whitespace-nowrap" style={{ left: `${x}%`, top: `${yu}%`, transform: 'translate(-50%,70%)' }}>{s.users}</span>
                    </div>
                  );
                })}
                {series.length === 0 && (
                  <p className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm">// no_data_in_range</p>
                )}
              </div>
              {/* x labels aligned to points */}
              <div className="relative h-4 mt-1">
                {series.map((s, i) => {
                  const x = xAt(i);
                  return (
                    <span key={s.key} className="absolute text-[10px] text-gray-400 font-mono -translate-x-1/2 whitespace-nowrap" style={{ left: `${x}%` }}>
                      {granularity === 'day' ? new Date(s.key).getUTCDate() : s.key.slice(2)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* right Y axis — active users */}
          <div className="flex flex-col justify-between h-56 text-left text-xs font-mono text-cyan-600 py-1 shrink-0 w-8">
            <span>{usersAxis}</span>
            <span>{Math.round(usersAxis / 2)}</span>
            <span>0</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <div className="glass rounded-2xl p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-mono">
              <span className="text-gray-400">// </span>top_users() <span className="text-gray-400 text-sm">[{users.length}]</span>
            </h2>
            {selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="px-2.5 py-1 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-all font-mono text-xs"
              >
                ✕ show all
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {users.map((u, i) => (
              <button
                key={u.user_id}
                onClick={() => setSelectedUser((cur) => (cur?.id === u.user_id ? null : { id: u.user_id, email: u.email }))}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                  selectedUser?.id === u.user_id ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-white/50 hover:bg-white'
                }`}
                title="Click to filter recent lessons by this user"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-mono text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-gray-800 truncate">{u.email || `${u.user_id.slice(0, 8)}…`}</p>
                    <p className="font-mono text-xs text-gray-500">
                      {u.lessons} lessons · {u.tokens.toLocaleString()} tok · {Math.round(u.tokens / (u.lessons || 1)).toLocaleString()} tok/lesson
                    </p>
                    <p className="font-mono text-[10px] text-gray-400">last: {new Date(u.last).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <p className="font-mono text-sm font-bold text-emerald-600">${u.cost.toFixed(2)}</p>
                  <p className="font-mono text-xs text-gray-500">${(u.cost / (u.lessons || 1)).toFixed(4)}/lesson</p>
                </div>
              </button>
            ))}
            {users.length === 0 && <p className="text-center text-gray-500 font-mono text-sm py-8">// no_data_yet</p>}
          </div>
        </div>

        {/* CEFR Distribution */}
        <div className="glass rounded-2xl p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-mono">
              <span className="text-gray-400">// </span>cefr_distribution()
            </h2>
            {selectedUser && (
              <span className="font-mono text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
                filtered: {selectedUser.email || `${selectedUser.id.slice(0, 8)}…`}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {['C2', 'C1', 'B2', 'B1', 'A2', 'A1'].map((level) => {
              const count = cefr.counts[level] || 0;
              const percentage = cefr.total > 0 ? (count / cefr.total) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-bold text-gray-700">{level}</span>
                    <span className="font-mono text-sm text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
            {cefr.total === 0 && (
              <p className="text-center text-gray-500 font-mono text-sm py-8">
                // no_assessments_yet{lang !== 'global' ? ` for ${lang.toUpperCase()}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Lessons Table */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-xl font-bold font-mono">
            <span className="text-gray-400">// </span>recent_lessons()
          </h2>
          {selectedUser && (
            <span className="font-mono text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
              filtered: {selectedUser.email || `${selectedUser.id.slice(0, 8)}…`}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">User</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Lang</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Scenario</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Duration</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">CEFR</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Tokens</th>
                <th className="text-right py-3 px-4 font-mono text-sm text-gray-600">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((lesson) => (
                <tr key={lesson.lesson_id} className="border-b border-gray-200 hover:bg-white/50">
                  <td className="py-3 px-4 font-mono text-sm">{new Date(lesson.completed_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-700">
                    {lesson.email || (lesson.user_id ? `${lesson.user_id.slice(0, 8)}…` : '—')}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-500 uppercase">{lesson.language}</td>
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/session/${lesson.lesson_id}`} className="tech-badge-emerald text-xs hover:underline" title="Review this session">
                      {lesson.scenario_title || '—'} →
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-600">
                    {Math.floor((lesson.duration_seconds || 0) / 60)}:{String((lesson.duration_seconds || 0) % 60).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-4">
                    {lesson.cefr_overall && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="tech-badge-cyan text-xs">{lesson.cefr_overall}</span>
                        {(() => {
                          const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                          const t = order.indexOf(lesson.target_level || '');
                          const o = order.indexOf(lesson.cefr_overall || '');
                          if (t < 0 || o < 0) return null;
                          if (o === t) return <span className="text-blue-500" title={`Target ${lesson.target_level} — met`}>●</span>;
                          if (o > t) return <span className="text-green-600" title={`Target ${lesson.target_level} — above target`}>▲</span>;
                          return <span className="text-red-600" title={`Target ${lesson.target_level} — below target`}>▼</span>;
                        })()}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-600">{(lesson.total_tokens || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono text-sm text-right font-bold text-emerald-600">${(lesson.total_cost || 0).toFixed(4)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 font-mono text-sm">// no_lessons_yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LangSelector({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex gap-1 items-center">
      <span className="font-mono text-xs text-gray-400 mr-1">lang:</span>
      {(['global', 'en', 'fr', 'pt'] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
            value === opt ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'
          }`}
        >
          {opt === 'global' ? 'Global' : opt.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// KPI Card Component
function KPICard({ title, value, subtitle, icon, trend }: { title: string; value: string; subtitle: string; icon: string; trend: 'up' | 'down' | 'neutral' }) {
  const trendColors = { up: 'text-green-600', down: 'text-red-600', neutral: 'text-gray-600' };
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
