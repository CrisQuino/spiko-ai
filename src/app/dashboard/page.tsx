'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getUserProfile, getUserConversations, getUserStats, type Profile, type Conversation, type UserStats } from '@/lib/supabase';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PracticeSetup from '@/components/PracticeSetup';

export default function DashboardPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);

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

      const [userStats, userConversations] = await Promise.all([
        getUserStats(user.id),
        getUserConversations(user.id)
      ]);

      setProfile(userProfile);
      setStats(userStats);
      setConversations(userConversations || []);
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
        {/* Welcome */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold font-mono gradient-text mb-2">
            Welcome back, {firstName}! 👋
          </h2>
          <p className="text-gray-600 font-mono text-sm">
            <span className="text-gray-400">// </span>Track your progress and improve your technical English
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="📚"
            title="totalConversations"
            value={stats?.totalConversations || 0}
            subtitle={`${stats?.totalConversations || 0} completed`}
            delay={0}
          />
          <StatCard
            icon="✅"
            title="averageScore"
            value={`${stats?.averageScore || 0}/100`}
            subtitle="Overall performance"
            delay={0.1}
          />
          <StatCard
            icon="⏱"
            title="practice_time"
            value={`${stats?.totalTimeMinutes || 0}m`}
            subtitle="Total speaking time"
            delay={0.2}
          />
          <StatCard
            icon="⚡"
            title="last_activity"
            value={stats?.lastActivity ? 'Recently' : 'No activity'}
            subtitle="Most recent session"
            delay={0.3}
          />
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

              {conversations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">💬</span>
                  </div>
                  <p className="text-gray-500 font-mono text-sm mb-6">
                    <span className="text-gray-400">// </span>no_conversations_yet
                  </p>
                  <button
                    onClick={() => setSetupOpen(true)}
                    className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white rounded-xl font-mono font-semibold hover:shadow-xl transition-all"
                  >
                    <span>&gt; start_first_practice()</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv, i) => (
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
                <Tip number={1} text="Practice daily for 10-15 minutes for best results" />
                <Tip number={2} text="Focus on technical vocabulary specific to your role" />
                <Tip number={3} text="Try different difficulty levels to challenge yourself" />
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
