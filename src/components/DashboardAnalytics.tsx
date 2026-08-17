'use client';

/**
 * Shared analytics panels (KPIs, API-cost bar chart, activity dual-axis line
 * chart, top users, CEFR distribution, recent lessons). Driven entirely by the
 * `lessons` prop, so the super-admin dashboard passes the whole platform and the
 * manager team dashboard passes only its company's lessons — same panels, scoped
 * data. Holds its own language / granularity / range / selected-user filter state.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { type AdminLesson } from '@/lib/admin-queries';
import { channelOf, type Channel } from '@/lib/supabase';
import { useUi } from '@/lib/ui-i18n';
import CefrTrendChart from '@/components/CefrTrendChart';

const CHANNEL_META: Record<Channel, { label: string; badge: string }> = {
  free: { label: 'Free', badge: 'bg-gray-100 text-gray-600' },
  b2c: { label: 'B2C', badge: 'bg-emerald-100 text-emerald-700' },
  b2b: { label: 'B2B', badge: 'bg-indigo-100 text-indigo-700' },
};

type Lang = 'global' | 'en' | 'fr' | 'pt';
type Granularity = 'day' | 'month';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (s: string) => { const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (s: string) => { const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Auto-scaling axis: a fixed number of evenly-spaced "nice" ticks (1/2/5 ×10ⁿ),
// so gridlines and labels always line up with the data — and with BOTH axes of a
// dual-axis chart — and the axis grows on its own as numbers get bigger, no
// manual tuning. Always returns `intervals`+1 ticks from 0..max (max ≥ dataMax).
function niceScale(dataMax: number, intervals = 4, integer = false): { max: number; ticks: number[] } {
  const raw = (dataMax > 0 ? dataMax : 1) / intervals;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  // Count axes (lessons, active users) can never be fractional — force a whole
  // step of at least 1, so ticks like 0.5 / 1.5 users never appear.
  if (integer) step = Math.max(1, Math.ceil(step));
  const max = step * intervals;
  const ticks: number[] = [];
  for (let i = 0; i <= intervals; i++) ticks.push(+(step * i).toFixed(6));
  return { max, ticks };
}
type SortKey = 'cost' | 'usage' | 'cefr';

export default function DashboardAnalytics({ lessons, sessionHref = '/dashboard/session', priceView = false }: { lessons: AdminLesson[]; sessionHref?: string; priceView?: boolean }) {
  const { d } = useUi();
  // Managers see PRICE (cost already marked-up server-side); super-admin sees
  // raw API cost. Only the labels differ here — the numbers arrive correct.
  const lbl = {
    total: priceView ? 'Total Price' : d.admin.totalCost,
    avg: priceView ? 'Avg Price' : d.admin.avgCost,
    chart: priceView ? 'revenue()' : 'api_ai_costs()',
    col: priceView ? 'Price' : d.admin.cost,
    sort: priceView ? 'price' : 'cost',
  };
  const [lang, setLang] = useState<Lang>('global');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [rangeStart, setRangeStart] = useState<string>(() => { const x = new Date(); x.setDate(x.getDate() - 30); return x.toISOString().slice(0, 10); });
  const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string | null } | null>(null);
  const [topSort, setTopSort] = useState<SortKey>('cost');
  // Channel = revenue tier (free / B2C paid / B2B corporate). Super-admin only —
  // for clarity of costs vs revenue by channel. Applied first, before everything.
  const [channel, setChannel] = useState<'all' | Channel>('all');
  // 'all' | 'b2c' (no company) | '<company_id>'
  const [company, setCompany] = useState<string>('all');

  const channelLessons = useMemo(
    () => (channel === 'all' ? lessons : lessons.filter((l) => channelOf(l) === channel)),
    [lessons, channel],
  );
  // Which channels are actually present (so we only offer real options).
  const channelOptions = useMemo(() => {
    const s = new Set<Channel>();
    lessons.forEach((l) => s.add(channelOf(l)));
    return (['free', 'b2c', 'b2b'] as Channel[]).filter((c) => s.has(c));
  }, [lessons]);

  // Distinct companies present in the (channel-filtered) data — drives the company filter.
  const companyOptions = useMemo(() => {
    const m = new Map<string, string>();
    let hasB2c = false;
    channelLessons.forEach((l) => { if (l.company_id) m.set(l.company_id, l.company_name || l.company_id); else hasB2c = true; });
    return { companies: [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)), hasB2c };
  }, [channelLessons]);
  // The company filter drives EVERYTHING (KPIs included), applied before language.
  const companyLessons = useMemo(() => {
    if (company === 'all') return channelLessons;
    if (company === 'b2c') return channelLessons.filter((l) => !l.company_id);
    return channelLessons.filter((l) => l.company_id === company);
  }, [channelLessons, company]);

  const langLessons = useMemo(() => (lang === 'global' ? companyLessons : companyLessons.filter((l) => l.language === lang)), [companyLessons, lang]);
  // Everything except the "this month/today" KPIs derives from the date range.
  const rangeLessons = useMemo(() => {
    const inRange = (s: string) => { const k = dayKey(s); return (!rangeStart || k >= rangeStart) && (!rangeEnd || k <= rangeEnd); };
    return langLessons.filter((l) => inRange(l.completed_at));
  }, [langLessons, rangeStart, rangeEnd]);

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

  const series = useMemo(() => {
    const buckets: Record<string, { key: string; cost: number; lessons: number; tokens: number; userSet: Set<string> }> = {};
    rangeLessons.forEach((l) => {
      const key = granularity === 'day' ? dayKey(l.completed_at) : monthKey(l.completed_at);
      if (!buckets[key]) buckets[key] = { key, cost: 0, lessons: 0, tokens: 0, userSet: new Set() };
      buckets[key].cost += Number(l.total_cost || 0);
      buckets[key].lessons += 1;
      buckets[key].tokens += Number(l.total_tokens || 0);
      buckets[key].userSet.add(l.user_id);
    });
    return Object.values(buckets).map((b) => ({ key: b.key, cost: b.cost, lessons: b.lessons, tokens: b.tokens, users: b.userSet.size })).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [rangeLessons, granularity]);

  const rangeTotal = useMemo(() => series.reduce((s, b) => s + b.cost, 0), [series]);
  const costScale = useMemo(() => niceScale(Math.max(0, ...series.map((s) => s.cost))), [series]);
  const lessonsScale = useMemo(() => niceScale(Math.max(0, ...series.map((s) => s.lessons)), 4, true), [series]);
  const usersScale = useMemo(() => niceScale(Math.max(0, ...series.map((s) => s.users)), 4, true), [series]);
  const xAt = (i: number) => (series.length > 1 ? 8 + (i / (series.length - 1)) * 84 : 50);

  const users = useMemo(() => {
    const m: Record<string, { user_id: string; email: string | null; company_id: string | null; plan: string | null; lessons: number; cost: number; tokens: number; last: string; cefrSum: number; cefrN: number }> = {};
    rangeLessons.forEach((l) => {
      const k = l.user_id;
      if (!m[k]) m[k] = { user_id: k, email: l.email, company_id: l.company_id, plan: l.plan, lessons: 0, cost: 0, tokens: 0, last: l.completed_at, cefrSum: 0, cefrN: 0 };
      m[k].lessons += 1;
      m[k].cost += Number(l.total_cost || 0);
      m[k].tokens += Number(l.total_tokens || 0);
      if (l.completed_at > m[k].last) m[k].last = l.completed_at;
      const ci = CEFR.indexOf(l.cefr_overall || ''); if (ci >= 0) { m[k].cefrSum += ci; m[k].cefrN += 1; }
    });
    return Object.values(m).map((u) => ({ ...u, cefr: u.cefrN ? u.cefrSum / u.cefrN : -1 }));
  }, [rangeLessons]);

  const sortedUsers = useMemo(() => {
    const by = topSort === 'usage' ? (a: typeof users[number], b: typeof users[number]) => b.lessons - a.lessons
      : topSort === 'cefr' ? (a: typeof users[number], b: typeof users[number]) => b.cefr - a.cefr || b.lessons - a.lessons
        : (a: typeof users[number], b: typeof users[number]) => b.cost - a.cost;
    return [...users].sort(by);
  }, [users, topSort]);

  const scoped = useMemo(() => (selectedUser ? rangeLessons.filter((l) => l.user_id === selectedUser.id) : rangeLessons), [rangeLessons, selectedUser]);

  const cefr = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    scoped.forEach((l) => { if (l.cefr_overall) { counts[l.cefr_overall] = (counts[l.cefr_overall] || 0) + 1; total += 1; } });
    return { counts, total };
  }, [scoped]);

  const recent = useMemo(
    () => [...scoped].sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1)).slice(0, selectedUser ? 100 : 20),
    [scoped, selectedUser],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-3 flex-wrap">
        {!priceView && channelOptions.length > 1 && (
          <ChannelSelector value={channel} onChange={(v) => { setChannel(v); setCompany('all'); setSelectedUser(null); }} options={channelOptions} />
        )}
        {companyOptions.companies.length + (companyOptions.hasB2c ? 1 : 0) > 1 && (
          <CompanySelector value={company} onChange={(v) => { setCompany(v); setSelectedUser(null); }} options={companyOptions} />
        )}
        <LangSelector value={lang} onChange={setLang} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title={lbl.total} value={`$${kpis.cost.toFixed(2)}`} subtitle={`${kpis.lessons} ${d.admin.lessons}`} icon="💰" trend={kpis.cost > 0 ? 'up' : 'neutral'} />
        <KPICard title={d.admin.activeUsers} value={kpis.users.toString()} subtitle={d.admin.thisMonth} icon="👥" trend="up" />
        <KPICard title={d.admin.lessonsToday} value={kpis.today.toString()} subtitle={new Date().toLocaleDateString()} icon="📚" trend="neutral" />
        <KPICard title={lbl.avg} value={`$${kpis.avg.toFixed(4)}`} subtitle={`${(kpis.tokens / 1000).toFixed(0)}k ${d.admin.tokens}`} icon="📊" trend="down" />
      </div>

      {/* API AI Costs */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>{lbl.chart}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {(['day', 'month'] as const).map((g) => (
                <button key={g} onClick={() => setGranularity(g)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${granularity === g ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>{g === 'day' ? d.admin.days : d.admin.months}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 font-mono text-xs text-gray-600">
              <input type="date" value={rangeStart} max={rangeEnd} onChange={(e) => setRangeStart(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
              <span>→</span>
              <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => setRangeEnd(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
            </div>
          </div>
        </div>
        <div className="font-mono text-sm text-gray-500 mb-3">{d.admin.rangeTotal}: <span className="font-bold text-emerald-600">${rangeTotal.toFixed(4)}</span> · {series.length} {granularity === 'day' ? 'day(s)' : 'month(s)'}</div>
        <div className="flex gap-3">
          <div className="flex flex-col-reverse justify-between h-64 text-right text-xs font-mono text-gray-400 py-1 shrink-0 w-16">
            {costScale.ticks.map((t) => <span key={t}>${t.toFixed(2)}</span>)}
          </div>
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[500px] h-64 flex items-end gap-1 border-l border-b border-gray-200 relative">
              {costScale.ticks.map((t) => <div key={t} className="absolute left-0 right-0 border-t border-dashed border-gray-100" style={{ bottom: `${(t / costScale.max) * 100}%` }}></div>)}
              {series.map((b) => {
                const h = costScale.max > 0 ? (b.cost / costScale.max) * 100 : 0;
                return (
                  <div key={b.key} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                    <div className="w-full bg-gradient-to-t from-emerald-500 to-cyan-500 rounded-t hover:from-emerald-600 hover:to-cyan-600 transition-all cursor-pointer min-h-[2px] relative" style={{ height: `${h}%` }}>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] font-mono text-gray-600 whitespace-nowrap font-semibold">${b.cost.toFixed(3)}</span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap font-mono z-10">${b.cost.toFixed(4)}<br />{b.lessons} lessons · {b.users} users · {b.tokens.toLocaleString()} tok<br />{b.key}</div>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 font-mono truncate max-w-full">{granularity === 'day' ? new Date(b.key).getUTCDate() : b.key.slice(2)}</div>
                  </div>
                );
              })}
              {series.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm">// no_data_in_range</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>activity()</h2>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{d.admin.lessonsLeft}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500"></span>{d.admin.usersRight}</span>
            <span className="text-gray-400">({granularity === 'day' ? d.admin.perDay : d.admin.perMonth})</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-col-reverse justify-between h-56 text-right text-xs font-mono text-emerald-600 py-1 shrink-0 w-8">{lessonsScale.ticks.map((t) => <span key={t}>{t}</span>)}</div>
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="relative h-56 border-l border-r border-b border-gray-200">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  {lessonsScale.ticks.map((t) => <line key={t} x1="0" y1={100 - (t / lessonsScale.max) * 100} x2="100" y2={100 - (t / lessonsScale.max) * 100} stroke="#f3f4f6" strokeWidth="0.5" />)}
                  {series.length > 1 && (
                    <>
                      <polyline fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" points={series.map((s, i) => `${xAt(i)},${100 - (s.lessons / lessonsScale.max) * 100}`).join(' ')} />
                      <polyline fill="none" stroke="#06b6d4" strokeWidth="2" vectorEffect="non-scaling-stroke" points={series.map((s, i) => `${xAt(i)},${100 - (s.users / usersScale.max) * 100}`).join(' ')} />
                    </>
                  )}
                </svg>
                {series.map((s, i) => {
                  const x = xAt(i); const yl = 100 - (s.lessons / lessonsScale.max) * 100; const yu = 100 - (s.users / usersScale.max) * 100;
                  return (
                    <div key={s.key}>
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow" style={{ left: `${x}%`, top: `${yl}%`, transform: 'translate(-50%,-50%)' }} title={`${s.lessons} lessons`} />
                      <span className="absolute text-[10px] font-mono font-bold text-emerald-700 whitespace-nowrap" style={{ left: `${x}%`, top: `${yl}%`, transform: 'translate(-50%,-170%)' }}>{s.lessons}</span>
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-white shadow" style={{ left: `${x}%`, top: `${yu}%`, transform: 'translate(-50%,-50%)' }} title={`${s.users} active users`} />
                      <span className="absolute text-[10px] font-mono font-bold text-cyan-700 whitespace-nowrap" style={{ left: `${x}%`, top: `${yu}%`, transform: 'translate(-50%,70%)' }}>{s.users}</span>
                    </div>
                  );
                })}
                {series.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm">// no_data_in_range</p>}
              </div>
              <div className="relative h-4 mt-1">
                {series.map((s, i) => { const x = xAt(i); return <span key={s.key} className="absolute text-[10px] text-gray-400 font-mono -translate-x-1/2 whitespace-nowrap" style={{ left: `${x}%` }}>{granularity === 'day' ? new Date(s.key).getUTCDate() : s.key.slice(2)}</span>; })}
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse justify-between h-56 text-left text-xs font-mono text-cyan-600 py-1 shrink-0 w-8">{usersScale.ticks.map((t) => <span key={t}>{t}</span>)}</div>
        </div>
      </div>

      {/* CEFR progress — target vs assessed (respects language + range + granularity) */}
      <CefrTrendChart lessons={langLessons} granularity={granularity} rangeStart={rangeStart} rangeEnd={rangeEnd} />

      {/* Top users + CEFR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>top_users() <span className="text-gray-400 text-sm">[{users.length}]</span></h2>
            {selectedUser && <button onClick={() => setSelectedUser(null)} className="px-2.5 py-1 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-all font-mono text-xs">✕ {d.admin.showAll}</button>}
          </div>
          <div className="flex gap-1 mb-3">
            <span className="font-mono text-xs text-gray-400 mr-1 self-center">by:</span>
            {([['usage', 'usage'], ['cost', lbl.sort], ['cefr', 'CEFR']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTopSort(k)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${topSort === k ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>{label}</button>
            ))}
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {sortedUsers.map((u, i) => (
              <button key={u.user_id} onClick={() => setSelectedUser((cur) => (cur?.id === u.user_id ? null : { id: u.user_id, email: u.email }))} className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${selectedUser?.id === u.user_id ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-white/50 hover:bg-white'}`} title={d.admin.clickFilter}>
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-mono text-sm font-bold">{i + 1}</div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-gray-800 truncate flex items-center gap-1.5"><span className="truncate">{u.email || `${u.user_id.slice(0, 8)}…`}</span><ChannelBadge lesson={u} /></p>
                    <p className="font-mono text-xs text-gray-500">{u.lessons} lessons · {u.tokens.toLocaleString()} tok · avg CEFR {u.cefr >= 0 ? CEFR[Math.floor(u.cefr)] : '—'}</p>
                    <p className="font-mono text-[10px] text-gray-400">last: {new Date(u.last).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  {topSort === 'cefr' ? (
                    <p className="font-mono text-lg font-bold gradient-text">{u.cefr >= 0 ? CEFR[Math.floor(u.cefr)] : '—'}</p>
                  ) : topSort === 'usage' ? (
                    <p className="font-mono text-lg font-bold text-emerald-600">{u.lessons}<span className="text-xs text-gray-400"> sess</span></p>
                  ) : (
                    <p className="font-mono text-sm font-bold text-emerald-600">${u.cost.toFixed(2)}</p>
                  )}
                  <p className="font-mono text-xs text-gray-500">${(u.cost / (u.lessons || 1)).toFixed(4)}/lesson</p>
                </div>
              </button>
            ))}
            {users.length === 0 && <p className="text-center text-gray-500 font-mono text-sm py-8">// no_data_yet</p>}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>cefr_distribution()</h2>
            {selectedUser && <span className="font-mono text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">{d.admin.filtered}: {selectedUser.email || `${selectedUser.id.slice(0, 8)}…`}</span>}
          </div>
          <div className="space-y-3">
            {['C2', 'C1', 'B2', 'B1', 'A2', 'A1'].map((level) => {
              const count = cefr.counts[level] || 0;
              const percentage = cefr.total > 0 ? (count / cefr.total) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between mb-1"><span className="font-mono text-sm font-bold text-gray-700">{level}</span><span className="font-mono text-sm text-gray-600">{count} ({percentage.toFixed(1)}%)</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-3"><div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${percentage}%` }}></div></div>
                </div>
              );
            })}
            {cefr.total === 0 && <p className="text-center text-gray-500 font-mono text-sm py-8">// no_assessments_yet{lang !== 'global' ? ` for ${lang.toUpperCase()}` : ''}</p>}
          </div>
        </div>
      </div>

      {/* Recent Lessons */}
      <div className="glass rounded-2xl p-6 border border-gray-200/50">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>recent_lessons()</h2>
          {selectedUser && <span className="font-mono text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">filtered: {selectedUser.email || `${selectedUser.id.slice(0, 8)}…`}</span>}
        </div>
        <div className="overflow-auto max-h-96 rounded-lg border border-gray-100">
          <table className="w-full">
            <thead className="sticky top-0 bg-white/95 backdrop-blur z-10">
              <tr className="border-b border-gray-300">
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.date}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.user}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.lang}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.scenario}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">{d.admin.duration}</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">CEFR</th>
                <th className="text-left py-3 px-4 font-mono text-sm text-gray-600">Tokens</th>
                <th className="text-right py-3 px-4 font-mono text-sm text-gray-600">{lbl.col}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((lesson) => (
                <tr key={lesson.lesson_id} className="border-b border-gray-200 hover:bg-white/50">
                  <td className="py-3 px-4 font-mono text-sm">{new Date(lesson.completed_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-700"><span className="inline-flex items-center gap-1.5">{lesson.email || (lesson.user_id ? `${lesson.user_id.slice(0, 8)}…` : '—')}<ChannelBadge lesson={lesson} /></span></td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-500 uppercase">{lesson.language}</td>
                  <td className="py-3 px-4">
                    <Link href={`${sessionHref}/${lesson.lesson_id}`} className="tech-badge-emerald text-xs hover:underline" title="Review this session">{lesson.scenario_title || '—'} →</Link>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-600">{Math.floor((lesson.duration_seconds || 0) / 60)}:{String((lesson.duration_seconds || 0) % 60).padStart(2, '0')}</td>
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
              {recent.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-500 font-mono text-sm">// no_lessons_yet</td></tr>}
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
        <button key={opt} onClick={() => onChange(opt)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${value === opt ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>{opt === 'global' ? 'Global' : opt.toUpperCase()}</button>
      ))}
    </div>
  );
}

function ChannelSelector({ value, onChange, options }: { value: 'all' | Channel; onChange: (v: 'all' | Channel) => void; options: Channel[] }) {
  return (
    <div className="flex gap-1 items-center">
      <span className="font-mono text-xs text-gray-400 mr-1">Channel:</span>
      {(['all', ...options] as const).map((opt) => (
        <button key={opt} onClick={() => onChange(opt)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${value === opt ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>
          {opt === 'all' ? 'All' : CHANNEL_META[opt].label}
        </button>
      ))}
    </div>
  );
}

function ChannelBadge({ lesson }: { lesson: { company_id: string | null; plan: string | null } }) {
  const c = channelOf(lesson);
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${CHANNEL_META[c].badge}`}>{CHANNEL_META[c].label}</span>;
}

function CompanySelector({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { companies: { id: string; name: string }[]; hasB2c: boolean } }) {
  return (
    <div className="flex gap-1 items-center">
      <span className="font-mono text-xs text-gray-400 mr-1">Company:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1 font-mono text-xs text-gray-700">
        <option value="all">All</option>
        {options.hasB2c && <option value="b2c">B2C (individuals)</option>}
        {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, trend }: { title: string; value: string; subtitle: string; icon: string; trend: 'up' | 'down' | 'neutral' }) {
  const trendColors = { up: 'text-green-600', down: 'text-red-600', neutral: 'text-gray-600' };
  return (
    <div className="glass rounded-xl p-6 border border-gray-200/50 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        <div className={`text-xs font-mono ${trendColors[trend]}`}>{trend === 'up' && '↗'}{trend === 'down' && '↘'}{trend === 'neutral' && '→'}</div>
      </div>
      <div className="mb-1"><p className="text-2xl font-bold font-mono gradient-text">{value}</p></div>
      <p className="text-sm font-mono text-gray-600 mb-1">{title}</p>
      <p className="text-xs font-mono text-gray-500">{subtitle}</p>
    </div>
  );
}
