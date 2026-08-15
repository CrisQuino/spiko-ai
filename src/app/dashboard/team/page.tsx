'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getInviteUrl } from '@/lib/config';
import Link from 'next/link';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

type Member = { id: string; email: string | null; full_name: string | null; role: string; status: string; sessions: number };
type Pending = { id: string; email: string; role: string; status: string; expires_at: string; created_at: string };
type Company = { id: string; name: string; max_users: number | null; allowed_email_domain: string | null; status: string };
type Overview = { company: Company; members: Member[]; pending: Pending[]; seats: { active: number; pending: number; max: number | null } };

const ERR_MSG: Record<string, string> = {
  domain_mismatch: 'Email must use the company domain',
  already_member: 'That person is already on the team',
  already_invited: 'That email already has a pending invite',
  seats_full: 'No seats left — ask your admin to raise the member limit',
  company_suspended: 'Company is suspended',
  'valid email required': 'Enter a valid email',
};
const errorLabel = (code?: string) => (code ? ERR_MSG[code] : undefined);

export default function TeamDashboardPage() {
  const router = useRouter();
  const { d } = useUi();
  const [loading, setLoading] = useState(true);
  const [ov, setOv] = useState<Overview | null>(null);
  const [selfId, setSelfId] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const teamApi = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action, ...params }),
    });
    return { status: res.status, body: await res.json().catch(() => ({} as any)) };
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    setSelfId(user.id);
    const r = await teamApi('overview');
    if (r.status === 403) { router.push('/dashboard'); return; }
    if (r.status === 200) setOv(r.body);
    setLoading(false);
  }, [router, teamApi]);

  useEffect(() => { load(); }, [load]);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setMsg(''); setInviteLink('');
    const r = await teamApi('invite_member', { email: inviteEmail.trim() });
    if (r.status !== 200) {
      flash('❌ ' + (errorLabel(r.body?.error) || r.body?.error || 'Failed to invite'));
      setInviting(false);
      return;
    }
    const url = getInviteUrl(r.body.invitation.token);
    setInviteLink(url);
    // Best-effort email; the copyable link always works even if email isn't configured.
    try {
      await fetch('/api/send-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), companyName: ov?.company.name, inviteUrl: url, role: 'employee' }),
      });
    } catch { /* ignore — link is shown regardless */ }
    flash('✅ Invitation created');
    setInviteEmail('');
    setInviting(false);
    load();
  };

  const revoke = async (m: Member) => {
    const r = await teamApi('revoke_member', { user_id: m.id, revoked: m.status !== 'revoked' });
    if (r.status === 200) { flash(m.status !== 'revoked' ? '✅ Member revoked' : '✅ Member reinstated'); load(); }
    else flash('❌ ' + (r.body?.error || 'error'));
  };
  const cancelInvite = async (p: Pending) => {
    const r = await teamApi('cancel_invite', { invitation_id: p.id });
    if (r.status === 200) { flash('✅ Invite cancelled'); load(); }
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

  const seats = ov?.seats;
  const seatsFull = seats?.max != null && seats.active + seats.pending >= seats.max;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center font-mono text-white font-bold">👥</div>
              <div>
                <h1 className="text-white font-mono font-bold text-xl">{d.team.title}</h1>
                <p className="text-blue-400 text-xs font-mono">// {ov?.company?.name || 'manage_your_team'}</p>
              </div>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">dashboard()</Link>
              <Link href="/" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">home()</Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
                className="text-red-400 hover:text-red-300 transition-colors font-mono text-sm"
              >logout()</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard icon="👥" title="seats_used" value={`${(seats?.active ?? 0) + (seats?.pending ?? 0)}/${seats?.max ?? '∞'}`} subtitle={`${seats?.active ?? 0} active · ${seats?.pending ?? 0} pending`} />
          <StatCard icon="✅" title="active_members" value={seats?.active ?? 0} subtitle={d.team.teamSize} />
          <StatCard icon="📧" title="pending_invites" value={seats?.pending ?? 0} subtitle={d.team.awaiting} />
          <StatCard icon="🌐" title="email_domain" value={ov?.company?.allowed_email_domain || 'any'} subtitle="allowed domain" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Members */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl p-6 border border-gray-200/50">
              <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>team_members [{ov?.members.length ?? 0}]</h2>
                <button
                  onClick={() => { setShowInvite(true); setInviteLink(''); setMsg(''); }}
                  disabled={seatsFull}
                  title={seatsFull ? 'No seats left' : ''}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono text-sm font-semibold hover:shadow-xl disabled:opacity-40 transition-all"
                >&gt; invite_member()</button>
              </div>

              {(ov?.members.length ?? 0) === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">👥</span></div>
                  <p className="text-gray-500 font-mono text-sm mb-6"><span className="text-gray-400">// </span>no_team_members_yet</p>
                  <button onClick={() => setShowInvite(true)} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono font-semibold hover:shadow-xl transition-all">&gt; invite_first_member()</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {ov!.members.map((m) => (
                    <div key={m.id} className="glass rounded-xl p-4 border border-gray-200/50">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-mono font-bold">
                            {(m.full_name || m.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold text-gray-800 truncate">{m.full_name || d.team.unknown}</p>
                            <p className="font-mono text-xs text-gray-500 truncate">{m.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 shrink-0">
                          <span className="tech-badge-cyan capitalize">{m.role}</span>
                          {m.status === 'revoked' && <span className="tech-badge-orange">revoked</span>}
                          <span className="text-sm font-mono text-gray-600"><span className="text-emerald-600">{m.sessions}</span> {d.team.sessions}</span>
                          {m.id !== selfId && m.role !== 'manager' && (
                            <button
                              onClick={() => revoke(m)}
                              className={`px-3 py-1.5 rounded-md font-mono text-xs ${m.status === 'revoked' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            >{m.status === 'revoked' ? 'reinstate()' : 'revoke()'}</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending */}
            {(ov?.pending.length ?? 0) > 0 && (
              <div className="glass rounded-2xl p-6 border border-gray-200/50">
                <h3 className="text-lg font-bold font-mono mb-4"><span className="text-gray-400">// </span>pending_invitations [{ov!.pending.length}]</h3>
                <div className="space-y-3">
                  {ov!.pending.map((p) => (
                    <div key={p.id} className="glass rounded-xl p-4 border border-orange-200/50">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-gray-800 truncate">{p.email}</p>
                          <p className="font-mono text-xs text-gray-500 mt-1">{d.team.invited} {new Date(p.created_at).toLocaleDateString()} · expires {new Date(p.expires_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="tech-badge-orange">pending</span>
                          <button onClick={() => cancelInvite(p)} className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono text-xs">cancel()</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6 border border-gray-200/50">
              <h3 className="text-lg font-bold font-mono mb-4"><span className="text-gray-400">// </span>quick_actions</h3>
              <div className="space-y-3">
                <button onClick={() => setShowInvite(true)} disabled={seatsFull} className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-3 rounded-xl font-mono font-semibold hover:shadow-xl disabled:opacity-40 transition-all">&gt; invite_member()</button>
              </div>
              {seatsFull && <p className="mt-3 font-mono text-xs text-orange-600">// seat limit reached — ask your admin to raise it</p>}
            </div>

            <div className="glass rounded-2xl p-6 border border-gray-200/50">
              <h3 className="text-lg font-bold font-mono mb-4"><span className="text-gray-400">// </span>manager_tips</h3>
              <div className="space-y-4">
                <Tip number={1} text={d.team.tips[0]} />
                <Tip number={2} text={d.team.tips[1]} />
                <Tip number={3} text={d.team.tips[2]} />
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`mt-6 glass rounded-xl p-4 border ${msg.startsWith('✅') ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <p className="font-mono text-sm">{msg}</p>
          </div>
        )}
      </main>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6 z-50" onClick={() => setShowInvite(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-8 max-w-md w-full border border-gray-200/50">
            <h3 className="text-2xl font-bold font-mono gradient-text mb-2">invite.member()</h3>
            <p className="font-mono text-xs text-gray-500 mb-6">
              {ov?.company?.allowed_email_domain ? `// only @${ov.company.allowed_email_domain} addresses` : '// any email address'}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-600 mb-2"><span className="text-gray-400">// </span>email_address</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-mono">$</span>
                  <input
                    type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={ov?.company?.allowed_email_domain ? `colleague@${ov.company.allowed_email_domain}` : d.team.emailPlaceholder}
                    className="w-full pl-10 pr-4 py-3 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200/50"
                  />
                </div>
              </div>

              {inviteLink && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="font-mono text-xs text-emerald-700 mb-1">// invite link (copy &amp; share):</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={inviteLink} className="flex-1 bg-white/70 border border-emerald-200 rounded px-2 py-1 font-mono text-xs" />
                    <button onClick={() => navigator.clipboard?.writeText(inviteLink)} className="px-2 py-1 rounded bg-emerald-600 text-white font-mono text-xs hover:bg-emerald-700">copy</button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowInvite(false)} className="flex-1 py-3 glass border-2 border-gray-300 rounded-xl font-mono font-semibold hover:border-cyan-500 transition-all">close()</button>
                <button
                  onClick={sendInvite} disabled={inviting || !inviteEmail}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono font-semibold hover:shadow-xl disabled:opacity-50 transition-all"
                >
                  {inviting ? 'sending()' : '> send_invite()'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value, subtitle }: { icon: string; title: string; value: string | number; subtitle: string }) {
  return (
    <div className="glass rounded-xl p-6 border border-gray-200/50 hover:shadow-xl transition-all">
      <div className="text-3xl mb-4">{icon}</div>
      <p className="text-2xl font-bold font-mono gradient-text mb-2 break-all">{value}</p>
      <p className="text-sm font-mono text-gray-600 mb-1">{title}</p>
      <p className="text-xs font-mono text-gray-500">{subtitle}</p>
    </div>
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
