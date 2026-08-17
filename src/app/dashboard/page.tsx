'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getUserProfile, getUserConversations, getUserCefrLessons, type Profile, type Conversation, type CefrLesson } from '@/lib/supabase';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PracticeSetup from '@/components/PracticeSetup';
import CefrTrendChart from '@/components/CefrTrendChart';
import DashboardPaywall from '@/components/DashboardPaywall';
import { channelOf } from '@/lib/supabase';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

export default function DashboardPage() {
  const router = useRouter();
  const { d } = useUi();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  // Free (not-purchased) individuals get the paywall gate instead of the dashboard.
  const [isFree, setIsFree] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [cefrLessons, setCefrLessons] = useState<CefrLesson[]>([]);
  // Global filters — drive the KPI cards, recent_conversations AND the CEFR chart.
  const [fLang, setFLang] = useState<'global' | 'en' | 'fr' | 'pt'>('global');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const inRange = (s?: string | null) => {
    if (!s) return true;
    const k = s.slice(0, 10);
    return (!rangeStart || k >= rangeStart) && (!rangeEnd || k <= rangeEnd);
  };
  const filteredConversations = useMemo(
    () => conversations.filter((c) => (fLang === 'global' || c.language === fLang) && inRange(c.started_at)),
    [conversations, fLang, rangeStart, rangeEnd],
  );
  // KPI cards recomputed from the filtered set (same math as getUserStats).
  const fStats = useMemo(() => {
    const completed = filteredConversations.filter((c) => c.status === 'completed');
    const totalScore = completed.reduce((s, c) => s + (c.overall_score || 0), 0);
    const totalTime = filteredConversations.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    return {
      totalConversations: filteredConversations.length,
      averageScore: completed.length ? Math.round(totalScore / completed.length) : 0,
      totalTimeMinutes: Math.round(totalTime / 60),
      lastActivity: filteredConversations.length ? filteredConversations[0].started_at : null,
    };
  }, [filteredConversations]);
  const cefrForChart = useMemo(
    () => (fLang === 'global' ? cefrLessons : cefrLessons.filter((l) => l.language === fLang)),
    [cefrLessons, fLang],
  );

  useEffect(() => {
    // Check for error messages from redirect
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'admin_required') {
      setErrorMessage('Access denied: Admin privileges required');
      setTimeout(() => setErrorMessage(null), 5000);
    }
    
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      const isAdminUser = user.email === 'dash.crs@gmail.com';
      setIsUserAdmin(isAdminUser);
      
      let userProfile = await getUserProfile(user.id);

      if (userProfile) {
        const isManagerRole = userProfile.role === 'manager';
        setIsManager(isManagerRole);
        // Gate the dashboard for free individuals (no company + not premium).
        // Admins/managers/corporate/B2C-paid keep full access.
        setIsFree(!isAdminUser && channelOf(userProfile) === 'free');
      }
      
      if (userProfile && !userProfile.full_name && user.user_metadata?.full_name) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: user.user_metadata.full_name })
          .eq('id', user.id);
        
        if (!error) {
          userProfile.full_name = user.user_metadata.full_name;
        }
      }
      
      if (userProfile && !userProfile.full_name) {
        const displayName = user.user_metadata?.name || 
                           user.user_metadata?.full_name || 
                           user.email?.split('@')[0] || 
                           'User';
        userProfile.full_name = displayName;
      }

      const [userConversations, userCefr] = await Promise.all([
        getUserConversations(user.id),
        getUserCefrLessons(user.id),
      ]);

      setProfile(userProfile);
      setConversations(userConversations || []);
      setCefrLessons(userCefr || []);
      // Default the range to span all existing activity (so nothing is hidden
      // initially); narrowing it then filters every panel.
      const dates = [
        ...(userConversations || []).map((c) => c.started_at),
        ...(userCefr || []).map((l) => l.completed_at),
      ].filter(Boolean).map((s) => s.slice(0, 10)).sort();
      if (dates.length) setRangeStart(dates[0]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">// loading_dashboard()</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  // Free individuals: paywall gate instead of the dashboard. They can still run a
  // scenario + see a CEFR result from /demo.
  if (isFree) {
    return <DashboardPaywall firstName={profile?.full_name?.split(' ')[0]} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-lg flex items-center justify-center font-mono text-white font-bold">
                &lt;/&gt;
              </div>
              <div>
                <h1 className="text-white font-mono font-bold text-xl">SPEECK.AI</h1>
                <p className="text-emerald-400 text-xs font-mono">// user.dashboard</p>
              </div>
            </Link>
            
            <nav className="flex items-center space-x-6">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                home()
              </Link>
              <Link href="/demo" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                practice()
              </Link>
              <Link href="/dashboard/settings" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                settings()
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/');
                }}
                className="text-red-400 hover:text-red-300 transition-colors font-mono text-sm"
              >
                logout()
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Error Message Banner */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-red-500 text-white px-6 py-3"
        >
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xl">🚫</span>
              <span className="font-mono text-sm">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-white hover:text-red-100 font-mono text-sm"
            >
              dismiss()
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
        {/* Welcome */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold font-mono gradient-text mb-2">
            {d.dashboard.welcome}, {firstName}! 👋
          </h2>
          <p className="text-gray-600 font-mono text-sm">
            <span className="text-gray-400">// </span>{d.dashboard.subtitle}
          </p>
        </motion.div>

        {/* Global filters — language + date range drive every panel below. */}
        <div className="glass rounded-xl p-3 mb-6 border border-gray-200/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 items-center">
            <span className="font-mono text-xs text-gray-400 mr-1">// filter:</span>
            {(['global', 'en', 'fr', 'pt'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFLang(opt)}
                className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${fLang === opt ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}
              >
                {opt === 'global' ? 'Global' : opt.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-gray-600">
            <input type="date" value={rangeStart} max={rangeEnd} onChange={(e) => setRangeStart(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
            <span>→</span>
            <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => setRangeEnd(e.target.value)} className="bg-white/70 border border-gray-200 rounded-md px-2 py-1" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="📚"
            title="totalConversations"
            value={fStats.totalConversations}
            subtitle={`${fStats.totalConversations} ${d.dashboard.completed}`}
            delay={0}
          />
          <StatCard
            icon="✅"
            title="averageScore"
            value={`${fStats.averageScore}/100`}
            subtitle={d.dashboard.overall}
            delay={0.1}
          />
          <StatCard
            icon="⏱"
            title="practice_time"
            value={`${fStats.totalTimeMinutes}m`}
            subtitle={d.dashboard.speakingTime}
            delay={0.2}
          />
          <StatCard
            icon="⚡"
            title="last_activity"
            value={fStats.lastActivity ? d.dashboard.recently : d.dashboard.noActivity}
            subtitle={d.dashboard.mostRecent}
            delay={0.3}
          />
        </div>

        {/* CEFR progress — target vs assessed (avg ⌊·⌋). Language + range come
            from the global filters above; the chart keeps its own day/month toggle. */}
        <div className="mb-8">
          <CefrTrendChart lessons={cefrForChart} controls="granularity" rangeStart={rangeStart} rangeEnd={rangeEnd} />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Conversations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Conversations */}
            {showHistory && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6 border border-gray-200/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold font-mono">
                  <span className="text-gray-400">// </span>recent_conversations
                </h3>
                <Link href="/demo" className="text-cyan-600 hover:text-emerald-600 font-mono text-sm">
                  start_new() →
                </Link>
              </div>

              {filteredConversations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">💬</span>
                  </div>
                  <p className="text-gray-500 font-mono text-sm mb-6">
                    <span className="text-gray-400">// </span>{conversations.length === 0 ? 'no_conversations_yet' : 'no_conversations_in_range'}
                  </p>
                  <button
                    onClick={() => setSetupOpen(true)}
                    className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white rounded-xl font-mono font-semibold hover:shadow-xl transition-all"
                  >
                    <span>&gt; start_first_practice()</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {filteredConversations.map((conv, i) => (
                    <Link
                      key={i}
                      href={`/dashboard/session/${conv.scenario_id}`}
                      className="block glass rounded-xl p-4 hover:shadow-lg hover:border-cyan-400 transition-all border border-gray-200/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-sm font-bold text-gray-800">
                            {conv.scenario_title || 'Practice session'}
                          </p>
                          <p className="font-mono text-xs text-gray-500 mt-1">
                            <span className="text-emerald-600">
                              {conv.started_at ? new Date(conv.started_at).toLocaleDateString() : 'Today'}
                            </span>
                            <span className="mx-2">•</span>
                            <span>
                              {conv.duration_seconds
                                ? `${Math.floor(conv.duration_seconds / 60)}:${(conv.duration_seconds % 60).toString().padStart(2, '0')}`
                                : '—'}
                            </span>
                            <span className="mx-2 text-gray-300">→ review</span>
                          </p>
                        </div>
                        <div className="tech-badge-cyan">
                          {conv.overall_score || '—'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
            )}
          </div>

          {/* Right Column - Actions & Tips */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-2xl p-6 border border-gray-200/50"
            >
              <h3 className="text-lg font-bold font-mono mb-4">
                <span className="text-gray-400">// </span>quick_actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => setSetupOpen(true)}
                  className="block w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white text-center py-3 rounded-xl font-mono font-semibold hover:shadow-xl transition-all"
                >
                  <span>&gt; start_practice()</span>
                </button>
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="block w-full glass border-2 border-gray-300 text-gray-700 text-center py-3 rounded-xl font-mono font-semibold hover:border-cyan-500 transition-all"
                >
                  {showHistory ? 'hide_history()' : 'view_history()'}
                </button>
                
                {/* Team Dashboard - Only for Managers */}
                {isManager && (
                  <Link
                    href="/dashboard/team"
                    className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-3 rounded-xl font-mono font-semibold hover:shadow-xl transition-all border-2 border-blue-400"
                  >
                    <span>👥 team_dashboard()</span>
                  </Link>
                )}
                
                {/* Admin Dashboard - Only for dash.crs@gmail.com */}
                {isUserAdmin && (
                  <Link
                    href="/admin"
                    className="block w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white text-center py-3 rounded-xl font-mono font-semibold hover:shadow-xl transition-all border-2 border-emerald-500"
                  >
                    <span>🔐 admin_dashboard()</span>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="glass rounded-2xl p-6 border border-gray-200/50"
            >
              <h3 className="text-lg font-bold font-mono mb-4">
                <span className="text-gray-400">// </span>improvement_tips
              </h3>
              <div className="space-y-4">
                <Tip number={1} text={d.dashboard.tips[0]} />
                <Tip number={2} text={d.dashboard.tips[1]} />
                <Tip number={3} text={d.dashboard.tips[2]} />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <PracticeSetup
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        companyId={profile?.company_id ?? null}
      />
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, delay }: {
  icon: string;
  title: string;
  value: string | number;
  subtitle: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="glass rounded-xl p-6 border border-gray-200/50 hover:shadow-xl transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
      </div>
      <div className="mb-2">
        <p className="text-2xl font-bold font-mono gradient-text">{value}</p>
      </div>
      <p className="text-sm font-mono text-gray-600 mb-1">{title}</p>
      <p className="text-xs font-mono text-gray-500">{subtitle}</p>
    </motion.div>
  );
}

function Tip({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start space-x-3">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold text-white font-mono">{number}</span>
      </div>
      <p className="text-sm text-gray-600 font-mono">{text}</p>
    </div>
  );
}
