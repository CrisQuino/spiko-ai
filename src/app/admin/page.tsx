'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getAdminLessons, type AdminLesson } from '@/lib/admin-queries';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

type Lang = 'global' | 'en' | 'fr' | 'pt';
type Granularity = 'day' | 'month';

// Client-side super-admin allowlist for the dashboard gate. This is UX only —
// the real authorization is server-side (the /api/admin route + RLS). Defaults
// to the owner; an optional public env can add a test admin locally.
const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || 'dash.crs@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isSuperAdmin = (email?: string | null) => !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

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
  const { d } = useUi();
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
      const adminStatus = isSuperAdmin(user.email);
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
            <span className="text-red-600">// {d.admin.adminRequired}</span>
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-xs font-mono text-gray-500">{d.admin.yourEmail}:</p>
            <p className="font-mono text-sm text-gray-900 break-all">{userEmail || 'Not logged in'}</p>
            <p className="text-xs font-mono text-gray-500 mt-2">{d.admin.required}:</p>
            <p className="font-mono text-sm text-emerald-600">dash.crs@gmail.com</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-mono transition-all"
            >
              🔄 {d.admin.refresh}
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
          <p className="text-gray-600 font-mono text-sm">// {d.admin.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap"><LanguageSwitcher /><LangSelector value={lang} onChange={setLang} /></div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title={d.admin.totalCost} value={`$${kpis.cost.toFixed(2)}`} subtitle={`${kpis.lessons} ${d.admin.lessons}`} icon="💰" trend={kpis.cost > 0 ? 'up' : 'neutral'} />
        <KPICard title={d.admin.activeUsers} value={kpis.users.toString()} subtitle={d.admin.thisMonth} icon="👥" trend="up" />
        <KPICard title={d.admin.lessonsToday} value={kpis.today.toString()} subtitle={new Date().toLocaleDateString()} icon="📚" trend="neutral" />
        <KPICard title={d.admin.avgCost} value={`$${kpis.avg.toFixed(4)}`} subtitle={`${(kpis.tokens / 1000).toFixed(0)}k ${d.admin.tokens}`} icon="📊" trend="down" />
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
                  {g === 'day' ? d.admin.days : d.admin.months}
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
          {d.admin.rangeTotal}: <span className="font-bold text-emerald-600">${rangeTotal.toFixed(4)}</span> · {series.length} {granularity === 'day' ? 'day(s)' : 'month(s)'}
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
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{d.admin.lessonsLeft}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500"></span>{d.admin.usersRight}</span>
            <span className="text-gray-400">({granularity === 'day' ? d.admin.perDay : d.admin.perMonth})</span>
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
                ✕ {d.admin.showAll}
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
                title={d.admin.clickFilter}
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
                {d.admin.filtered}: {selectedUser.email || `${selectedUser.id.slice(0, 8)}…`}
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

      {/* Super-admin: companies + platform settings management */}
      <SuperAdminPanel />

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
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.date}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.user}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.lang}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.scenario}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.duration}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">CEFR</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Tokens</th>
                <th className="text-right py-3 px-4 font-mono text-sm text-gray-600">{d.admin.cost}</th>
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
      <span className="font-mono text-xs text-gray-400 mr-1">Filter:</span>
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

// ── Super-admin management (companies + platform settings) ──────────────────
type Company = {
  id: string; name: string; slug: string; status: string;
  allowed_email_domain: string | null; domain_mode: string; max_users: number | null;
  daily_practice_limit: number | null; monthly_practice_limit: number | null;
  max_jds_per_user: number | null; members: number; pending_invites: number;
};
type Member = { id: string; email: string | null; full_name: string | null; role: string; status: string };
type Pending = { id: string; email: string; role: string; status: string; expires_at: string };
type Settings = { free_monthly_sessions: number; free_max_jds: number; premium_max_jds: number };
type CompanyJd = { id: string; title: string; content: string; created_at: string };
type ApiFn = (action: string, params?: Record<string, unknown>) => Promise<{ status: number; body: any }>;

const num = (v: string) => (v === '' ? null : Number(v));
const lim = (v: number | null) => (v == null ? '∞' : String(v));

function SuperAdminPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sDraft, setSDraft] = useState({ free_monthly_sessions: '', free_max_jds: '', premium_max_jds: '' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { members: Member[]; pending: Pending[] }>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', allowed_email_domain: '', max_users: '5', daily_practice_limit: '', monthly_practice_limit: '', max_jds_per_user: '' });
  const [banQuery, setBanQuery] = useState('');
  const [b2cUsers, setB2cUsers] = useState<{ id: string; email: string; full_name: string | null; plan: string; company: string | null; company_id: string | null; banned: boolean }[] | null>(null);
  const [b2cLoading, setB2cLoading] = useState(false);
  const [highlightMember, setHighlightMember] = useState<string | null>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const api = async (action: string, params: Record<string, unknown> = {}) => {
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...params }),
    });
    return { status: r.status, body: await r.json().catch(() => ({} as any)) };
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const loadAll = async () => {
    const [s, c] = await Promise.all([api('get_settings'), api('list_companies')]);
    if (s.body?.settings) {
      setSettings(s.body.settings);
      setSDraft({
        free_monthly_sessions: String(s.body.settings.free_monthly_sessions ?? ''),
        free_max_jds: String(s.body.settings.free_max_jds ?? ''),
        premium_max_jds: String(s.body.settings.premium_max_jds ?? ''),
      });
    }
    if (c.body?.companies) setCompanies(c.body.companies);
  };
  useEffect(() => { if (token) loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const saveSettings = async () => {
    setBusy(true);
    const r = await api('update_settings', { patch: { ...sDraft } });
    setBusy(false);
    if (r.status === 200) { setSettings(r.body.settings); flash('✓ settings saved'); } else flash(`✕ ${r.body?.error || 'error'}`);
  };

  const createCompany = async () => {
    if (!form.name.trim()) return flash('✕ name required');
    setBusy(true);
    const r = await api('create_company', {
      name: form.name.trim(),
      allowed_email_domain: form.allowed_email_domain.trim() || null,
      max_users: num(form.max_users),
      daily_practice_limit: num(form.daily_practice_limit),
      monthly_practice_limit: num(form.monthly_practice_limit),
      max_jds_per_user: num(form.max_jds_per_user),
    });
    setBusy(false);
    if (r.status === 200) {
      setForm({ name: '', allowed_email_domain: '', max_users: '5', daily_practice_limit: '', monthly_practice_limit: '', max_jds_per_user: '' });
      setShowCreate(false);
      flash('✓ company created');
      loadAll();
    } else flash(`✕ ${r.body?.error || 'error'}`);
  };

  const toggleDetail = async (id: string) => {
    setHighlightMember(null); // manual toggling clears any jump highlight
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!detail[id]) {
      const r = await api('list_members', { company_id: id });
      setDetail((d) => ({ ...d, [id]: { members: r.body?.members || [], pending: r.body?.pending || [] } }));
    }
  };
  const refreshDetail = async (id: string) => {
    const r = await api('list_members', { company_id: id });
    setDetail((d) => ({ ...d, [id]: { members: r.body?.members || [], pending: r.body?.pending || [] } }));
  };

  const patchCompany = async (id: string, patch: Record<string, unknown>) => {
    setBusy(true);
    const r = await api('update_company', { id, patch });
    setBusy(false);
    if (r.status === 200) { flash('✓ updated'); loadAll(); } else flash(`✕ ${r.body?.error || 'error'}`);
  };
  const suspendCompany = async (c: Company) => {
    const r = await api('suspend_company', { id: c.id, suspended: c.status !== 'suspended' });
    if (r.status === 200) { flash(c.status !== 'suspended' ? '✓ suspended' : '✓ reactivated'); loadAll(); }
  };
  const deleteCompany = async (c: Company) => {
    if (!window.confirm(`Delete "${c.name}"? Members are detached and its JDs/invitations removed. This cannot be undone.`)) return;
    const r = await api('delete_company', { id: c.id });
    if (r.status === 200) { flash('✓ company deleted'); setOpenId(null); loadAll(); } else flash(`✕ ${r.body?.error || 'error'}`);
  };
  const inviteManager = async (id: string, email: string, reset: () => void) => {
    if (!email.trim()) return flash('✕ email required');
    const r = await api('invite_manager', { company_id: id, email: email.trim() });
    if (r.status === 200) { flash(`✓ manager invited: ${r.body.invitation.email}`); reset(); refreshDetail(id); loadAll(); } else flash(`✕ ${r.body?.error || 'error'}`);
  };
  const removeFromCompany = async (id: string, m: Member) => {
    if (!window.confirm(`Remove ${m.email} from this company? They become a free individual user (re-invite to add them back).`)) return;
    const r = await api('remove_from_company', { user_id: m.id });
    if (r.status === 200) { flash(`✓ ${m.email} removed from company`); refreshDetail(id); loadAll(); }
    else flash(`✕ ${r.body?.error || 'error'}`);
  };
  const searchUsers = async (query: string) => {
    setB2cLoading(true);
    const r = await api('list_users', { search: query.trim() });
    setB2cLoading(false);
    if (r.status === 200) setB2cUsers(r.body.users || []);
    else flash(`✕ ${r.body?.error || 'error'}`);
  };
  // Live, debounced search — filters as you type; also loads the full list initially.
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => searchUsers(banQuery), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banQuery, token]);
  const banById = async (u: { id: string; email: string }, banned: boolean) => {
    const r = await api('ban_user', { user_id: u.id, banned });
    if (r.status === 200) { flash(banned ? `✓ ${u.email} banned (cannot log in)` : `✓ ${u.email} unbanned`); searchUsers(banQuery); }
    else flash(`✕ ${r.body?.error || 'error'}`);
  };
  const deleteUserAcct = async (u: { id: string; email: string }) => {
    if (!window.confirm(`Delete ${u.email}? This permanently removes the account AND its lesson history — a hard reset (their monthly free sessions reset). This cannot be undone.`)) return;
    const r = await api('delete_user', { user_id: u.id });
    if (r.status === 200) { flash(`✓ ${u.email} deleted`); searchUsers(banQuery); }
    else flash(`✕ ${r.body?.error || 'error'}`);
  };
  // Jump from an account row to that member inside their company panel: expand
  // the company, load its members, highlight the row, and scroll it into view.
  const goToCompany = async (companyId: string, userId: string) => {
    setOpenId(companyId);
    if (!detail[companyId]) await refreshDetail(companyId);
    setHighlightMember(userId); // persists until another jump or the panel is toggled
    setTimeout(() => {
      document.getElementById(`company-${companyId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };
  const setMemberRole = async (id: string, m: Member, role: 'manager' | 'employee') => {
    const r = await api('set_member_role', { user_id: m.id, role });
    if (r.status === 200) {
      flash(role === 'manager'
        ? `✓ ${m.email} is now manager${r.body.allowed_email_domain ? ` · domain → @${r.body.allowed_email_domain}` : ''}`
        : `✓ ${m.email} set to employee`);
      refreshDetail(id); loadAll();
    } else flash(`✕ ${r.body?.error || 'error'}`);
  };

  return (
    <div className="glass rounded-2xl p-6 border border-gray-200/50">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h2 className="text-xl font-bold font-mono">
          <span className="text-gray-400">// </span>super_admin()
        </h2>
        {msg && <span className={`font-mono text-xs px-2.5 py-1 rounded-md ${msg.startsWith('✓') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{msg}</span>}
      </div>

      {/* Platform settings */}
      <div className="mb-8">
        <h3 className="font-mono text-sm text-gray-500 mb-3">platform_settings()</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            ['free_monthly_sessions', 'Free sessions / month'],
            ['free_max_jds', 'Free max JDs'],
            ['premium_max_jds', 'Premium max JDs'],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <span className="font-mono text-xs text-gray-500">{label}</span>
              <input
                type="number" min={0}
                value={sDraft[k]}
                onChange={(e) => setSDraft((s) => ({ ...s, [k]: e.target.value }))}
                className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={saveSettings} disabled={busy} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono text-sm disabled:opacity-50 hover:shadow-lg transition-all">
            save_settings()
          </button>
          {settings && (
            <span className="font-mono text-xs text-gray-400">
              live: {settings.free_monthly_sessions}/mo · {settings.free_max_jds} free JDs · {settings.premium_max_jds} premium JDs
            </span>
          )}
        </div>
      </div>

      {/* Companies */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-mono text-sm text-gray-500">companies() <span className="text-gray-400">[{companies.length}]</span></h3>
        <button onClick={() => setShowCreate((v) => !v)} className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-700 font-mono text-xs transition-all">
          {showCreate ? '✕ cancel' : '+ new_company()'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-5 p-4 rounded-xl bg-white/60 border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Acme Corp" />
          <Field label="Allowed email domain" value={form.allowed_email_domain} onChange={(v) => setForm({ ...form, allowed_email_domain: v })} placeholder="acme.com" />
          <Field label="Max users" value={form.max_users} onChange={(v) => setForm({ ...form, max_users: v })} type="number" />
          <Field label="Daily limit (blank = ∞)" value={form.daily_practice_limit} onChange={(v) => setForm({ ...form, daily_practice_limit: v })} type="number" />
          <Field label="Monthly limit (blank = ∞)" value={form.monthly_practice_limit} onChange={(v) => setForm({ ...form, monthly_practice_limit: v })} type="number" />
          <Field label="Max JDs / user (blank = ∞)" value={form.max_jds_per_user} onChange={(v) => setForm({ ...form, max_jds_per_user: v })} type="number" />
          <div className="sm:col-span-2 lg:col-span-3">
            <button onClick={createCompany} disabled={busy} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono text-sm disabled:opacity-50 hover:shadow-lg transition-all">
              create_company()
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {companies.map((c) => (
          <div key={c.id} id={`company-${c.id}`} className="rounded-xl bg-white/50 border border-gray-200">
            <button onClick={() => toggleDetail(c.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/70 transition-all">
              <div className="min-w-0">
                <p className="font-mono text-sm text-gray-800 truncate">
                  {c.name}
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${c.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.status}</span>
                </p>
                <p className="font-mono text-xs text-gray-500">
                  {c.members}/{lim(c.max_users)} users · {c.pending_invites} pending · {c.allowed_email_domain || 'any domain'} · {lim(c.daily_practice_limit)}/day · {lim(c.monthly_practice_limit)}/mo · {lim(c.max_jds_per_user)} JDs/user
                </p>
              </div>
              <span className="font-mono text-xs text-gray-400 shrink-0 pl-2">{openId === c.id ? '▾' : '▸'}</span>
            </button>

            {openId === c.id && (
              <CompanyDetail
                c={c}
                detail={detail[c.id]}
                busy={busy}
                onPatch={patchCompany}
                onSuspend={suspendCompany}
                onDelete={deleteCompany}
                onInvite={inviteManager}
                onRemove={removeFromCompany}
                onSetRole={setMemberRole}
                api={api}
                flash={flash}
                highlightMember={highlightMember}
              />
            )}
          </div>
        ))}
        {companies.length === 0 && <p className="text-center text-gray-500 font-mono text-sm py-8">// no_companies_yet</p>}
      </div>

      {/* Account access — search ANY user (corporate or B2C) and toggle their login */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="font-mono text-sm text-gray-500 mb-1">account_access() <span className="text-gray-400">— B2C login control (ban / delete)</span></h3>
        <p className="font-mono text-xs text-gray-400 mb-3">Type to filter. B2C users can be banned (reversible) or deleted (hard reset — clears their lesson history). Corporate members are shown for lookup only (blue) and managed from their company panel.</p>
        <div className="flex items-center gap-2">
          <input
            value={banQuery} onChange={(e) => setBanQuery(e.target.value)}
            placeholder="type to search by email… (blank = all users)"
            className="flex-1 min-w-[220px] bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm"
          />
          <span className="font-mono text-xs text-gray-400 shrink-0">{b2cLoading ? 'searching…' : b2cUsers ? `${b2cUsers.length} shown` : ''}</span>
        </div>
        {b2cUsers && (
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1 pr-1">
            {b2cUsers.length === 0 && <p className="font-mono text-xs text-gray-400">// no_users_match</p>}
            {b2cUsers.map((u) => (
              <div key={u.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md font-mono text-xs ${u.company ? 'bg-indigo-50' : 'bg-white/60'}`}>
                <span className="truncate min-w-0">
                  {u.email}
                  {u.company ? (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">in {u.company}</span>
                  ) : (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{u.plan || 'b2c'}</span>
                  )}
                  {u.banned && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700">banned</span>}
                </span>
                {u.company ? (
                  <button onClick={() => u.company_id && goToCompany(u.company_id, u.id)} className="text-indigo-600 hover:text-indigo-800 hover:underline shrink-0" title={`Open ${u.company} and highlight this member`}>
                    manage in {u.company} →
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.banned ? (
                      <button onClick={() => banById(u, false)} className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">unban()</button>
                    ) : (
                      <button onClick={() => banById(u, true)} className="px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200">ban()</button>
                    )}
                    <button onClick={() => deleteUserAcct(u)} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">delete()</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="font-mono text-xs text-gray-500">{label}</span>
      <input type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
    </label>
  );
}

function CompanyDetail({ c, detail, busy, onPatch, onSuspend, onDelete, onInvite, onRemove, onSetRole, api, flash, highlightMember }: {
  c: Company; detail?: { members: Member[]; pending: Pending[] }; busy: boolean;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onSuspend: (c: Company) => void; onDelete: (c: Company) => void;
  onInvite: (id: string, email: string, reset: () => void) => void;
  onRemove: (id: string, m: Member) => void;
  onSetRole: (id: string, m: Member, role: 'manager' | 'employee') => void;
  api: ApiFn; flash: (m: string) => void; highlightMember?: string | null;
}) {
  const [limits, setLimits] = useState({
    max_users: String(c.max_users ?? ''),
    daily_practice_limit: c.daily_practice_limit == null ? '' : String(c.daily_practice_limit),
    monthly_practice_limit: c.monthly_practice_limit == null ? '' : String(c.monthly_practice_limit),
    max_jds_per_user: c.max_jds_per_user == null ? '' : String(c.max_jds_per_user),
    domain_mode: c.domain_mode || 'any',
  });
  const [invEmail, setInvEmail] = useState('');

  // Company JDs (team-wide), managed via a scrollable list + upload/edit modal.
  const [jds, setJds] = useState<CompanyJd[] | null>(null);
  const [jdModal, setJdModal] = useState<null | { mode: 'new' | 'edit'; id?: string; title: string; content: string }>(null);
  const loadJds = async () => { const r = await api('list_company_jds', { company_id: c.id }); setJds(r.body?.jds || []); };
  useEffect(() => { loadJds(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [c.id]);
  const saveJd = async () => {
    if (!jdModal) return;
    if (!jdModal.title.trim() || !jdModal.content.trim()) return flash('✕ title and content required');
    const r = jdModal.mode === 'new'
      ? await api('upload_company_jd', { company_id: c.id, title: jdModal.title, content: jdModal.content })
      : await api('update_company_jd', { id: jdModal.id, title: jdModal.title, content: jdModal.content });
    if (r.status === 200) { flash(jdModal.mode === 'new' ? '✓ company JD uploaded' : '✓ company JD updated'); setJdModal(null); loadJds(); }
    else flash(`✕ ${r.body?.error || 'error'}`);
  };
  const deleteJd = async (id: string) => {
    if (!window.confirm('Delete this company JD? The whole team loses access to it.')) return;
    const r = await api('delete_company_jd', { id });
    if (r.status === 200) { flash('✓ company JD deleted'); setJdModal(null); loadJds(); }
  };

  return (
    <div className="border-t border-gray-200 p-4 space-y-5">
      {/* Edit limits */}
      <div>
        <h4 className="font-mono text-xs text-gray-500 mb-2">edit_limits()</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Max users" type="number" value={limits.max_users} onChange={(v) => setLimits({ ...limits, max_users: v })} />
          <Field label="Daily (∞ blank)" type="number" value={limits.daily_practice_limit} onChange={(v) => setLimits({ ...limits, daily_practice_limit: v })} />
          <Field label="Monthly (∞ blank)" type="number" value={limits.monthly_practice_limit} onChange={(v) => setLimits({ ...limits, monthly_practice_limit: v })} />
          <Field label="JDs/user (∞ blank)" type="number" value={limits.max_jds_per_user} onChange={(v) => setLimits({ ...limits, max_jds_per_user: v })} />
          <label className="block">
            <span className="font-mono text-xs text-gray-500">Invite domain</span>
            <select value={limits.domain_mode} onChange={(e) => setLimits({ ...limits, domain_mode: e.target.value })} className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm">
              <option value="any">Any domain</option>
              <option value="manager">Manager&apos;s domain</option>
            </select>
          </label>
        </div>
        <p className="mt-1 font-mono text-[11px] text-gray-400">
          {limits.domain_mode === 'manager'
            ? `Invites restricted to the manager's domain${c.allowed_email_domain ? ` (currently @${c.allowed_email_domain})` : ' (set once you assign a manager)'}.`
            : 'Invites accept any email domain.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onPatch(c.id, {
              max_users: num(limits.max_users),
              daily_practice_limit: num(limits.daily_practice_limit),
              monthly_practice_limit: num(limits.monthly_practice_limit),
              max_jds_per_user: num(limits.max_jds_per_user),
              domain_mode: limits.domain_mode,
            })}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono text-xs disabled:opacity-50"
          >
            save_limits()
          </button>
          <button onClick={() => onSuspend(c)} className="px-3 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 font-mono text-xs">
            {c.status === 'suspended' ? 'reactivate()' : 'suspend()'}
          </button>
          <button onClick={() => onDelete(c)} className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 font-mono text-xs">
            delete_company()
          </button>
        </div>
      </div>

      {/* Invite manager */}
      <div>
        <h4 className="font-mono text-xs text-gray-500 mb-2">invite_manager() <span className="text-gray-400">— email a NEW manager (or promote an existing member below)</span></h4>
        <div className="flex flex-wrap gap-2">
          <input value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="manager@company.com" className="flex-1 min-w-[200px] bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
          <button onClick={() => onInvite(c.id, invEmail, () => setInvEmail(''))} className="px-3 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 font-mono text-xs">
            send_invite()
          </button>
        </div>
      </div>

      {/* Company JDs — scrollable list + upload/edit modal */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h4 className="font-mono text-xs text-gray-500">company_jds() {jds ? `[${jds.length}]` : ''} <span className="text-gray-400">— visible to the whole team; click to edit</span></h4>
          <button onClick={() => setJdModal({ mode: 'new', title: '', content: '' })} className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-700 font-mono text-xs">+ upload_jd()</button>
        </div>
        {!jds ? (
          <p className="font-mono text-xs text-gray-400">// loading…</p>
        ) : jds.length === 0 ? (
          <p className="font-mono text-xs text-gray-400">// no_company_jds — upload one to share with the team</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {jds.map((j) => (
              <button key={j.id} onClick={() => setJdModal({ mode: 'edit', id: j.id, title: j.title, content: j.content })} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/60 hover:bg-white font-mono text-xs text-left">
                <span className="truncate min-w-0">{j.title}</span>
                <span className="text-gray-400 shrink-0">{new Date(j.created_at).toLocaleDateString()} · edit ›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Members + pending */}
      <div>
        <h4 className="font-mono text-xs text-gray-500 mb-2">
          members() {detail ? `[${detail.members.length}]` : ''}
          <span className="text-gray-400"> — assign a manager; the manager&apos;s email domain becomes the invite filter</span>
        </h4>
        {!detail ? (
          <p className="font-mono text-xs text-gray-400">// loading…</p>
        ) : (
          <div className="space-y-1">
            {detail.members.map((m) => (
              <div key={m.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md font-mono text-xs transition-all ${highlightMember === m.id ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-white/60'}`}>
                <span className="truncate min-w-0">
                  {m.email || `${m.id.slice(0, 8)}…`}
                  <span className={`ml-2 px-1.5 py-0.5 rounded ${m.role === 'manager' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>{m.role}</span>
                  {m.status === 'revoked' && <span className="ml-2 text-red-600">revoked</span>}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onSetRole(c.id, m, m.role === 'manager' ? 'employee' : 'manager')}
                    className={`px-2 py-1 rounded ${m.role === 'manager' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                    title={m.role === 'manager' ? 'Demote to employee' : 'Promote to manager (their domain becomes the invite filter)'}
                  >
                    {m.role === 'manager' ? 'unset_manager' : 'make_manager'}
                  </button>
                  <button onClick={() => onRemove(c.id, m)} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200" title="Remove from company (becomes a free individual)">
                    remove
                  </button>
                </div>
              </div>
            ))}
            {detail.members.length === 0 && <p className="font-mono text-xs text-gray-400">// no_members</p>}
            {detail.pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-amber-50 font-mono text-xs">
                <span className="truncate">{p.email} <span className="ml-2 text-amber-600">{p.role} · pending</span></span>
                <span className="text-gray-400">expires {new Date(p.expires_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company JD upload/edit modal */}
      {jdModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6 z-50" onClick={() => setJdModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-6 max-w-lg w-full border border-gray-200/50">
            <h3 className="font-mono text-sm font-bold mb-4">{jdModal.mode === 'new' ? 'upload_company_jd()' : 'edit_company_jd()'}</h3>
            <div className="space-y-3">
              <input value={jdModal.title} onChange={(e) => setJdModal({ ...jdModal, title: e.target.value })} placeholder="JD title" className="w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
              <textarea value={jdModal.content} onChange={(e) => setJdModal({ ...jdModal, content: e.target.value })} placeholder="Job description content…" rows={8} className="w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => setJdModal(null)} className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono text-xs">close()</button>
                {jdModal.mode === 'edit' && (
                  <button onClick={() => deleteJd(jdModal.id!)} className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 font-mono text-xs">delete()</button>
                )}
                <button onClick={saveJd} className="px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono text-xs">{jdModal.mode === 'new' ? 'upload()' : 'save()'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
