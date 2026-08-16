'use client';

/**
 * CEFR trend: two lines over time — the TARGET level the learner aimed for and
 * the ASSESSED level they actually demonstrated. When several sessions fall on
 * the same bucket, each line is the average of that bucket's levels, floored to
 * a whole CEFR band (always rounds DOWN). Y-axis is A1..C2.
 *
 * Two modes:
 *  - default (admin/team): the caller passes already language-filtered lessons
 *    plus the active granularity + date range, so it tracks the page filters.
 *  - standalone (individual dashboard): the chart owns its own language,
 *    granularity and date-range controls, rendered in its header.
 */

import { useMemo, useState } from 'react';

type Row = { completed_at: string; language?: string; target_level: string | null; cefr_overall: string | null };
type Lang = 'global' | 'en' | 'fr' | 'pt';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const idx = (l: string | null | undefined) => (l ? LEVELS.indexOf(l) : -1);
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (s: string) => { const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (s: string) => { const d = new Date(s); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export default function CefrTrendChart({
  lessons, granularity: gProp = 'day', rangeStart: rsProp, rangeEnd: reProp, controls = 'none',
}: { lessons: Row[]; granularity?: 'day' | 'month'; rangeStart?: string; rangeEnd?: string; controls?: 'full' | 'granularity' | 'none' }) {
  // Which controls this chart owns:
  //  full        — owns language + granularity + date-range (self-contained).
  //  granularity — owns only day/month; language + range come from the page's
  //                global filter (parent pre-filters lessons by language).
  //  none        — owns nothing; everything is driven by props (group dashboards).
  const ownsLang = controls === 'full';
  const ownsGranularity = controls === 'full' || controls === 'granularity';
  const ownsRange = controls === 'full';
  const [lang, setLang] = useState<Lang>('global');
  const [gState, setGState] = useState<'day' | 'month'>('day');
  const [rsState, setRsState] = useState<string>(() => daysAgo(30));
  const [reState, setReState] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const granularity = ownsGranularity ? gState : gProp;
  const rangeStart = ownsRange ? rsState : rsProp;
  const rangeEnd = ownsRange ? reState : reProp;
  const rows = useMemo(
    () => (ownsLang && lang !== 'global' ? lessons.filter((l) => l.language === lang) : lessons),
    [lessons, ownsLang, lang],
  );

  const series = useMemo(() => {
    const inRange = (s: string) => { const k = dayKey(s); return (!rangeStart || k >= rangeStart) && (!rangeEnd || k <= rangeEnd); };
    const buckets: Record<string, { key: string; t: number[]; a: number[] }> = {};
    rows.filter((l) => inRange(l.completed_at)).forEach((l) => {
      const key = granularity === 'day' ? dayKey(l.completed_at) : monthKey(l.completed_at);
      if (!buckets[key]) buckets[key] = { key, t: [], a: [] };
      const ti = idx(l.target_level); if (ti >= 0) buckets[key].t.push(ti);
      const ai = idx(l.cefr_overall); if (ai >= 0) buckets[key].a.push(ai);
    });
    return Object.values(buckets)
      .map((b) => ({
        key: b.key,
        target: b.t.length ? Math.floor(b.t.reduce((s, v) => s + v, 0) / b.t.length) : null,
        assessed: b.a.length ? Math.floor(b.a.reduce((s, v) => s + v, 0) / b.a.length) : null,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [rows, granularity, rangeStart, rangeEnd]);

  const xAt = (i: number) => (series.length > 1 ? 8 + (i / (series.length - 1)) * 84 : 50);
  const yAt = (v: number) => 100 - (v / 5) * 100;
  const line = (key: 'target' | 'assessed') =>
    series.map((s, i) => (s[key] == null ? null : `${xAt(i)},${yAt(s[key] as number)}`)).filter(Boolean).join(' ');

  const gBtn = (g: 'day' | 'month') => (
    <button key={g} onClick={() => setGState(g)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${granularity === g ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>{g === 'day' ? 'Days' : 'Months'}</button>
  );

  return (
    <div className="glass rounded-2xl p-6 border border-gray-200/50">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>cefr_progress()</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {ownsLang && (
            <div className="flex gap-1 items-center">
              <span className="font-mono text-xs text-gray-400 mr-1">Filter:</span>
              {(['global', 'en', 'fr', 'pt'] as const).map((opt) => (
                <button key={opt} onClick={() => setLang(opt)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${lang === opt ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>{opt === 'global' ? 'Global' : opt.toUpperCase()}</button>
              ))}
            </div>
          )}
          {ownsGranularity && <div className="flex gap-1">{gBtn('day')}{gBtn('month')}</div>}
          {ownsRange && (
            <div className="flex items-center gap-1 font-mono text-xs text-gray-600">
              <input type="date" value={rsState} max={reState} onChange={(e) => setRsState(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
              <span>→</span>
              <input type="date" value={reState} min={rsState} onChange={(e) => setReState(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
            </div>
          )}
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>assessed</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-amber-500"></span>target</span>
            <span className="text-gray-400">(avg ⌊·⌋)</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col-reverse justify-between h-56 text-right text-xs font-mono text-gray-400 py-1 shrink-0 w-8">
          {LEVELS.map((l) => <span key={l}>{l}</span>)}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[500px]">
            <div className="relative h-56 border-l border-b border-gray-200">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                {[0, 1, 2, 3, 4, 5].map((v) => <line key={v} x1="0" y1={yAt(v)} x2="100" y2={yAt(v)} stroke="#f3f4f6" strokeWidth="0.5" />)}
                {series.length > 1 && (
                  <>
                    <polyline fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" points={line('target')} />
                    <polyline fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" points={line('assessed')} />
                  </>
                )}
              </svg>
              {series.map((s, i) => {
                const x = xAt(i);
                return (
                  <div key={s.key}>
                    {s.target != null && <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow" style={{ left: `${x}%`, top: `${yAt(s.target)}%`, transform: 'translate(-50%,-50%)' }} title={`target ${LEVELS[s.target]}`} />}
                    {s.assessed != null && (
                      <>
                        <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow" style={{ left: `${x}%`, top: `${yAt(s.assessed)}%`, transform: 'translate(-50%,-50%)' }} title={`assessed ${LEVELS[s.assessed]}`} />
                        <span className="absolute text-[10px] font-mono font-bold text-emerald-700 whitespace-nowrap" style={{ left: `${x}%`, top: `${yAt(s.assessed)}%`, transform: 'translate(-50%,-165%)' }}>{LEVELS[s.assessed]}</span>
                      </>
                    )}
                  </div>
                );
              })}
              {series.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm">// no_cefr_data_in_range</p>}
            </div>
            <div className="relative h-4 mt-1">
              {series.map((s, i) => (
                <span key={s.key} className="absolute text-[10px] text-gray-400 font-mono -translate-x-1/2 whitespace-nowrap" style={{ left: `${xAt(i)}%` }}>
                  {granularity === 'day' ? new Date(s.key).getUTCDate() : s.key.slice(2)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
