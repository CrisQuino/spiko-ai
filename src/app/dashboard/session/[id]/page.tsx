'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, getLessonDetail, type LessonDetail } from '@/lib/supabase';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

const SKILLS: Array<{ key: string; label: string }> = [
  { key: 'pronunciation', label: 'Pronunciation' },
  { key: 'fluency', label: 'Fluency' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'comprehension', label: 'Comprehension' },
];

function scoreColor(score: number | null): string {
  if (score == null) return 'bg-gray-300';
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 55) return 'bg-cyan-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-orange-500';
}

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { d } = useUi();
  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<LessonDetail | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      const detail = await getLessonDetail(params.id);
      setLesson(detail);
      setLoading(false);
    })();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">// loading_session()</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
        <div className="text-center">
          <p className="text-gray-600 font-mono mb-4">// session_not_found</p>
          <Link href="/dashboard" className="text-cyan-600 font-mono hover:text-emerald-600">← cd ../dashboard</Link>
        </div>
      </div>
    );
  }

  const started = lesson.started_at ? new Date(lesson.started_at).toLocaleString() : '—';
  const mins = Math.floor((lesson.duration_seconds || 0) / 60);
  const secs = (lesson.duration_seconds || 0) % 60;
  const transcript = lesson.transcript || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-mono font-bold text-lg">{lesson.scenario_title || d.session.fallbackTitle}</h1>
            <p className="text-emerald-400 text-xs font-mono">// session.review</p>
          </div>
          <div className="flex items-center gap-3"><LanguageSwitcher className="text-gray-300 border-gray-700" /><Link href="/dashboard" className="text-gray-400 hover:text-white font-mono text-sm">← dashboard()</Link></div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Summary */}
        <div className="flex flex-wrap gap-6 items-center mb-8 font-mono text-sm text-gray-600">
          <span>📅 {started}</span>
          <span>⏱ {mins}:{secs.toString().padStart(2, '0')}</span>
          {lesson.cefr_overall && (
            <span className="flex items-center gap-2">
              {d.session.level}: <span className="text-2xl font-bold gradient-text">{lesson.cefr_overall}</span>
            </span>
          )}
          <span>🔤 {(lesson.total_tokens || 0).toLocaleString()} {d.session.tokens}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* CEFR metrics 1-by-1 */}
          <section className="glass rounded-2xl p-6 border border-gray-200/50">
            <h2 className="font-mono font-bold mb-4"><span className="text-gray-400">// </span>cefr_metrics</h2>
            <div className="space-y-4">
              {SKILLS.map((s) => {
                const level = (lesson as any)[`${s.key}_level`] as string | null;
                const score = (lesson as any)[`${s.key}_score`] as number | null;
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-gray-700">{d.session.skills[s.key as keyof typeof d.session.skills] || s.label}</span>
                      <span className="font-mono text-sm">
                        <span className="text-gray-400">{level || '—'}</span>{' '}
                        <span className="font-bold">{score != null ? `${score}/100` : ''}</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score || 0}%` }} />
                    </div>
                  </div>
                );
              })}
              {lesson.technical_accuracy_level && (
                <div className="pt-2 border-t border-gray-200/50 font-mono text-sm text-gray-600">
                  {d.session.jargon}: <span className="font-bold text-gray-800">{lesson.technical_accuracy_level}</span>
                  {lesson.technical_terms_used && lesson.technical_terms_used.length > 0 && (
                    <span className="text-gray-400"> · {lesson.technical_terms_used.length} {d.session.terms}</span>
                  )}
                </div>
              )}
            </div>

            {/* Feedback */}
            {(lesson.quick_feedback?.length || lesson.final_feedback) && (
              <div className="mt-6 pt-4 border-t border-gray-200/50">
                <h3 className="font-mono font-bold text-sm mb-2"><span className="text-gray-400">// </span>feedback</h3>
                {lesson.quick_feedback && lesson.quick_feedback.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 mb-3">
                    {lesson.quick_feedback.map((f, i) => (
                      <li key={i} className="text-sm text-gray-700">{f}</li>
                    ))}
                  </ul>
                )}
                {lesson.final_feedback && (
                  <p className="text-sm text-gray-700 whitespace-pre-line">{lesson.final_feedback}</p>
                )}
              </div>
            )}
          </section>

          {/* Conversation */}
          <section className="glass rounded-2xl p-6 border border-gray-200/50">
            <h2 className="font-mono font-bold mb-4"><span className="text-gray-400">// </span>conversation</h2>
            {transcript.length === 0 ? (
              <p className="text-sm text-gray-500 font-mono">// transcript_not_recorded</p>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {transcript.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white'
                        : 'glass border border-gray-200 text-gray-800'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
