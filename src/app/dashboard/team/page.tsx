'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  supabase, 
  getUserProfile, 
  getCompany,
  getCompanyStats,
  getCompanyEmployees,
  type Profile,
  type Company,
  type CompanyStats
} from '@/lib/supabase';
import { getInviteUrl } from '@/lib/config';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function TeamDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  
  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'employee' | 'manager'>('employee');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    loadTeamDashboard();
  }, []);

  const loadTeamDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const userProfile = await getUserProfile(user.id);
      
      if (!userProfile) {
        router.push('/dashboard');
        return;
      }

      // Check if user is manager
      if (userProfile.role !== 'manager') {
        console.error('Access denied: User is not a manager');
        router.push('/dashboard');
        return;
      }

      setProfile(userProfile);

      if (userProfile.company_id) {
        const [companyData, companyStats, companyEmployees, invites] = await Promise.all([
          getCompany(userProfile.company_id),
          getCompanyStats(userProfile.company_id),
          getCompanyEmployees(userProfile.company_id),
          fetchPendingInvites(userProfile.company_id)
        ]);

        setCompany(companyData);
        setStats(companyStats);
        setEmployees(companyEmployees || []);
        setPendingInvites(invites);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading team dashboard:', error);
      setLoading(false);
    }
  };

  const fetchPendingInvites = async (companyId: string) => {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invites:', error);
      return [];
    }

    return data || [];
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !company) return;
    
    setInviting(true);
    setInviteMessage('');

    try {
      // Create invitation token
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          email: inviteEmail,
          company_id: company.id,
          role: inviteRole,
          status: 'pending'
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send email
      const inviteUrl = getInviteUrl(invitation.token);
      
      const emailResponse = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          companyName: company.name,
          inviteUrl: inviteUrl,
          role: inviteRole
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send email');
      }

      setInviteMessage('✅ Invitation sent successfully!');
      setInviteEmail('');
      setShowInviteModal(false);
      
      // Refresh pending invites
      const invites = await fetchPendingInvites(company.id);
      setPendingInvites(invites);

    } catch (error: any) {
      console.error('Error sending invite:', error);
      setInviteMessage('❌ Failed to send invitation: ' + error.message);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">// loading_team_dashboard()</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center font-mono text-white font-bold">
                👥
              </div>
              <div>
                <h1 className="text-white font-mono font-bold text-xl">TEAM DASHBOARD</h1>
                <p className="text-blue-400 text-xs font-mono">// {company?.name || 'manage_your_team'}</p>
              </div>
            </Link>
            
            <nav className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                dashboard()
              </Link>
              <Link href="/" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">
                home()
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

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon="👥"
            title="total_members"
            value={stats?.totalEmployees || 0}
            subtitle="Team size"
            delay={0}
          />
          <StatCard
            icon="⭐"
            title="avg_performance"
            value={`${stats?.averageScore || 0}/100`}
            subtitle="Team average"
            delay={0.1}
          />
          <StatCard
            icon="📚"
            title="sessions_month"
            value={stats?.total_sessions || stats?.totalConversations || 0}
            subtitle="This month"
            delay={0.2}
          />
          <StatCard
            icon="📧"
            title="pending_invites"
            value={pendingInvites.length}
            subtitle="Awaiting response"
            delay={0.3}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Team Members */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6 border border-gray-200/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-mono">
                  <span className="text-gray-400">// </span>team_members
                </h2>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono text-sm font-semibold hover:shadow-xl transition-all"
                >
                  <span>&gt; invite_member()</span>
                </button>
              </div>

              {employees.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">👥</span>
                  </div>
                  <p className="text-gray-500 font-mono text-sm mb-6">
                    <span className="text-gray-400">// </span>no_team_members_yet
                  </p>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono font-semibold hover:shadow-xl transition-all"
                  >
                    <span>&gt; invite_first_member()</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {employees.map((employee, i) => (
                    <div key={i} className="glass rounded-xl p-4 hover:shadow-lg transition-all border border-gray-200/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-mono font-bold">
                            {employee.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-mono text-sm font-bold text-gray-800">
                              {employee.full_name || 'Unknown'}
                            </p>
                            <p className="font-mono text-xs text-gray-500">
                              {employee.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="tech-badge-cyan">
                            {employee.role || 'employee'}
                          </div>
                          <div className="text-sm font-mono text-gray-600">
                            <span className="text-emerald-600">{employee.total_sessions || 0}</span> sessions
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="glass rounded-2xl p-6 border border-gray-200/50 mt-6"
              >
                <h3 className="text-lg font-bold font-mono mb-4">
                  <span className="text-gray-400">// </span>pending_invitations
                </h3>
                <div className="space-y-3">
                  {pendingInvites.map((invite, i) => (
                    <div key={i} className="glass rounded-xl p-4 border border-orange-200/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-bold text-gray-800">
                            {invite.email}
                          </p>
                          <p className="font-mono text-xs text-gray-500 mt-1">
                            Invited {new Date(invite.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="tech-badge-orange">
                          pending
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="glass rounded-2xl p-6 border border-gray-200/50"
            >
              <h3 className="text-lg font-bold font-mono mb-4">
                <span className="text-gray-400">// </span>quick_actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-3 rounded-xl font-mono font-semibold hover:shadow-xl transition-all"
                >
                  <span>&gt; invite_member()</span>
                </button>
                <button className="block w-full glass border-2 border-gray-300 text-gray-700 text-center py-3 rounded-xl font-mono font-semibold hover:border-cyan-500 transition-all">
                  export_report()
                </button>
              </div>
            </motion.div>

            {/* Team Tips */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="glass rounded-2xl p-6 border border-gray-200/50"
            >
              <h3 className="text-lg font-bold font-mono mb-4">
                <span className="text-gray-400">// </span>manager_tips
              </h3>
              <div className="space-y-4">
                <Tip number={1} text="Encourage daily 10-15 min practice sessions" />
                <Tip number={2} text="Monitor team progress and provide feedback" />
                <Tip number={3} text="Celebrate improvements and milestones" />
              </div>
            </motion.div>
          </div>
        </div>

        {inviteMessage && (
          <div className={`mt-6 glass rounded-xl p-4 border ${
            inviteMessage.includes('✅') 
              ? 'border-emerald-200 bg-emerald-50/50' 
              : 'border-red-200 bg-red-50/50'
          }`}>
            <p className="font-mono text-sm">{inviteMessage}</p>
          </div>
        )}
      </main>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6 z-50"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-8 max-w-md w-full border border-gray-200/50"
            >
              <h3 className="text-2xl font-bold font-mono gradient-text mb-6">
                invite.member()
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-mono text-gray-600 mb-2">
                    <span className="text-gray-400">// </span>email_address
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-mono">$</span>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full pl-10 pr-4 py-3 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-mono text-gray-600 mb-2">
                    <span className="text-gray-400">// </span>role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'employee' | 'manager')}
                    className="w-full px-4 py-3 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200/50"
                  >
                    <option value="employee">employee</option>
                    <option value="manager">manager</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-3 glass border-2 border-gray-300 rounded-xl font-mono font-semibold hover:border-cyan-500 transition-all"
                  >
                    cancel()
                  </button>
                  <button
                    onClick={handleSendInvite}
                    disabled={inviting || !inviteEmail}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono font-semibold hover:shadow-xl disabled:opacity-50 transition-all"
                  >
                    {inviting ? (
                      <span className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>sending()</span>
                      </span>
                    ) : (
                      <span>&gt; send_invite()</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold text-white font-mono">{number}</span>
      </div>
      <p className="text-sm text-gray-600 font-mono">{text}</p>
    </div>
  );
}
