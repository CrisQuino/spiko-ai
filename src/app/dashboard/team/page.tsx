'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getInviteUrl } from '@/lib/config';
import { type AdminLesson } from '@/lib/admin-queries';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import Link from 'next/link';
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';

type Member = { id: string; email: string | null; full_name: string | null; role: string; status: string; sessions: number };
type Pending = { id: string; email: string; role: string; status: string; expires_at: string; created_at: string };
type Company = { id: string; name: string; max_users: number | null; allowed_email_domain: string | null; domain_mode: string; daily_practice_limit: number | null; monthly_practice_limit: number | null; max_jds_per_user: number | null; status: string };
type Overview = { company: Company; members: Member[]; pending: Pending[]; seats: { active: number; pending: number; max: number | null } };
type CompanyJd = { id: string; title: string; content: string; created_at: string };

const ERR_MSG: Record<string, string> = {
  domain_mismatch: 'Email must use the company domain',
  already_member: 'That person is already on the team',
  already_invited: 'That email already has a pending invite',
  seats_full: 'No seats left — ask your admin to raise the member limit',
  company_suspended: 'Company is suspended',
  'valid email required': 'Enter a valid email',
};
const lim = (v: number | null | undefined) => (v == null ? '∞' : String(v));

export default function TeamDashboardPage() {
  const router = useRouter();
  const { d } = useUi();
  const [loading, setLoading] = useState(true);
  const [ov, setOv] = useState<Overview | null>(null);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [jds, setJds] = useState<CompanyJd[]>([]);
  const [memberJds, setMemberJds] = useState<{ id: string; title: string; owner_email: string | null; created_at: string }[]>([]);
  const [selfId, setSelfId] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [jdModal, setJdModal] = useState<null | { mode: 'new' | 'edit'; id?: string; title: string; content: string }>(null);

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
    const [o, a, j, mj] = await Promise.all([teamApi('overview'), teamApi('analytics'), teamApi('list_company_jds'), teamApi('list_member_jds')]);
    if (o.status === 403) { router.push('/dashboard'); return; }
    if (o.status === 200) setOv(o.body);
    if (a.status === 200) setLessons(a.body.lessons || []);
    if (j.status === 200) setJds(j.body.jds || []);
    if (mj.status === 200) setMemberJds(mj.body.jds || []);
    setLoading(false);
  }, [router, teamApi]);

  useEffect(() => { load(); }, [load]);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setMsg(''); setInviteLink('');
    const r = await teamApi('invite_member', { email: inviteEmail.trim() });
    if (r.status !== 200) { flash('❌ ' + (ERR_MSG[r.body?.error] || r.body?.error || 'Failed to invite')); setInviting(false); return; }
    const url = getInviteUrl(r.body.invitation.token);
    setInviteLink(url);
    try {
      await fetch('/api/send-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail.trim(), companyName: ov?.company.name, inviteUrl: url, role: 'employee' }) });
    } catch { /* link shown regardless */ }
    flash('✅ Invitation created'); setInviteEmail(''); setInviting(false); load();
  };

  const removeMember = async (m: Member) => {
    if (!window.confirm(`Remove ${m.email} from the team? They become a free individual user (re-invite to add them back).`)) return;
    const r = await teamApi('remove_member', { user_id: m.id });
    if (r.status === 200) { flash('✅ Member removed'); load(); } else flash('❌ ' + (r.body?.error || 'error'));
  };
  const setRole = async (m: Member, role: 'manager' | 'employee') => {
    const r = await teamApi('set_member_role', { user_id: m.id, role });
    if (r.status === 200) { flash(role === 'manager' ? `✅ ${m.email} is now a manager` : `✅ ${m.email} set to employee`); load(); } else flash('❌ ' + (r.body?.error || 'error'));
  };
  const cancelInvite = async (p: Pending) => {
    const r = await teamApi('cancel_invite', { invitation_id: p.id });
    if (r.status === 200) { flash('✅ Invite cancelled'); load(); }
  };
  const setDomainMode = async (mode: string) => {
    const r = await teamApi('set_domain_mode', { mode });
    if (r.status === 200) { flash(`✅ Invite domain: ${mode === 'manager' ? "manager's domain" : 'any domain'}`); load(); } else flash('❌ ' + (r.body?.error || 'error'));
  };
  const saveJd = async () => {
    if (!jdModal) return;
    if (!jdModal.title.trim() || !jdModal.content.trim()) return flash('❌ title and content required');
    const r = jdModal.mode === 'new'
      ? await teamApi('upload_company_jd', { title: jdModal.title, content: jdModal.content })
      : await teamApi('update_company_jd', { id: jdModal.id, title: jdModal.title, content: jdModal.content });
    if (r.status === 200) { flash(jdModal.mode === 'new' ? '✅ JD uploaded' : '✅ JD updated'); setJdModal(null); load(); } else flash('❌ ' + (r.body?.error || 'error'));
  };
  const deleteJd = async (id: string) => {
    if (!window.confirm('Delete this company JD? The whole team loses access to it.')) return;
    const r = await teamApi('delete_company_jd', { id });
    if (r.status === 200) { flash('✅ JD deleted'); setJdModal(null); load(); }
  };
  const promoteJd = async (id: string) => {
    const r = await teamApi('promote_jd', { id });
    if (r.status === 200) { flash('✅ JD promoted — now shared with the whole team'); load(); } else flash('❌ ' + (r.body?.error || 'error'));
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
  const company = ov?.company;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-cyan-50/20">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center font-mono text-white font-bold">👥</div>
              <div>
                <h1 className="text-white font-mono font-bold text-xl">{d.team.title}</h1>
                <p className="text-blue-400 text-xs font-mono">// {company?.name || 'manage_your_team'}</p>
              </div>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">dashboard()</Link>
              <Link href="/" className="text-gray-400 hover:text-white transition-colors font-mono text-sm">home()</Link>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="text-red-400 hover:text-red-300 transition-colors font-mono text-sm">logout()</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex justify-end"><LanguageSwitcher /></div>

        {/* Company-scoped analytics — same panels as the super-admin dashboard */}
        <DashboardAnalytics lessons={lessons} />

        {/* Company management */}
        <div className="glass rounded-2xl p-6 border border-gray-200/50 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-bold font-mono"><span className="text-gray-400">// </span>company_management()</h2>
            <div className="flex items-center gap-4 font-mono text-xs text-gray-500">
              <span>seats: <b className="text-gray-800">{(seats?.active ?? 0) + (seats?.pending ?? 0)}/{lim(seats?.max)}</b></span>
              <span>{seats?.active ?? 0} active · {seats?.pending ?? 0} pending</span>
            </div>
          </div>

          {/* Limits (read-only, admin-controlled) + domain (manager-editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <ReadOnly label="Max users" value={lim(company?.max_users)} />
            <ReadOnly label="Daily limit" value={lim(company?.daily_practice_limit)} />
            <ReadOnly label="Monthly limit" value={lim(company?.monthly_practice_limit)} />
            <ReadOnly label="JDs / user" value={lim(company?.max_jds_per_user)} />
            <label className="block">
              <span className="font-mono text-xs text-gray-500">Invite domain</span>
              <select value={company?.domain_mode || 'any'} onChange={(e) => setDomainMode(e.target.value)} className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm">
                <option value="any">Any domain</option>
                <option value="manager">Manager&apos;s domain</option>
              </select>
            </label>
          </div>
          <p className="font-mono text-[11px] text-gray-400 -mt-3">
            Limits are set by your administrator. {company?.domain_mode === 'manager' ? `Invites restricted to @${company?.allowed_email_domain || '(assign a manager)'}.` : 'Invites accept any email domain.'}
          </p>

          {/* Company JDs */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="font-mono text-sm text-gray-500">company_jds() [{jds.length}] <span className="text-gray-400">— visible to the whole team; click to edit</span></h3>
              <button onClick={() => setJdModal({ mode: 'new', title: '', content: '' })} className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-700 font-mono text-xs">+ upload_jd()</button>
            </div>
            {jds.length === 0 ? (
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

          {/* Members' personal JDs — promote to the whole team */}
          <div>
            <h3 className="font-mono text-sm text-gray-500 mb-2">member_jds() [{memberJds.length}] <span className="text-gray-400">— members&apos; personal JDs; promote one to share with the whole team</span></h3>
            {memberJds.length === 0 ? (
              <p className="font-mono text-xs text-gray-400">// no personal member JDs</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {memberJds.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/60 font-mono text-xs">
                    <span className="truncate min-w-0">{j.title} <span className="text-gray-400">· {j.owner_email}</span></span>
                    <button onClick={() => promoteJd(j.id)} className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shrink-0" title="Make this a team-wide company JD">promote_to_team()</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="font-mono text-sm text-gray-500">team_members [{ov?.members.length ?? 0}]</h3>
              <button onClick={() => { setShowInvite(true); setInviteLink(''); setMsg(''); }} disabled={seatsFull} title={seatsFull ? 'No seats left' : ''} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono text-sm font-semibold hover:shadow-xl disabled:opacity-40 transition-all">&gt; invite_member()</button>
            </div>
            <div className="space-y-1">
              {ov!.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/60 font-mono text-xs">
                  <span className="truncate min-w-0">
                    {m.full_name || m.email}
                    <span className={`ml-2 px-1.5 py-0.5 rounded ${m.role === 'manager' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>{m.role}</span>
                    <span className="ml-2 text-gray-400">· {m.sessions} {d.team.sessions}</span>
                  </span>
                  {m.id !== selfId && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setRole(m, m.role === 'manager' ? 'employee' : 'manager')} className={`px-2 py-1 rounded ${m.role === 'manager' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>{m.role === 'manager' ? 'unset_manager' : 'make_manager'}</button>
                      {m.role !== 'manager' && <button onClick={() => removeMember(m)} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">remove()</button>}
                    </div>
                  )}
                </div>
              ))}
              {(ov?.members.length ?? 0) === 0 && <p className="font-mono text-xs text-gray-400">// no_team_members_yet</p>}
            </div>
          </div>

          {/* Pending invites */}
          {(ov?.pending.length ?? 0) > 0 && (
            <div>
              <h3 className="font-mono text-sm text-gray-500 mb-2">pending_invitations [{ov!.pending.length}]</h3>
              <div className="space-y-1">
                {ov!.pending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-amber-50 font-mono text-xs">
                    <span className="truncate min-w-0">{p.email} <span className="ml-2 text-amber-600">pending · expires {new Date(p.expires_at).toLocaleDateString()}</span></span>
                    <button onClick={() => cancelInvite(p)} className="px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 shrink-0">cancel()</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {msg && <div className={`glass rounded-xl p-4 border ${msg.startsWith('✅') ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}><p className="font-mono text-sm">{msg}</p></div>}
      </main>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6 z-50" onClick={() => setShowInvite(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-8 max-w-md w-full border border-gray-200/50">
            <h3 className="text-2xl font-bold font-mono gradient-text mb-2">invite.member()</h3>
            <p className="font-mono text-xs text-gray-500 mb-6">{company?.domain_mode === 'manager' && company?.allowed_email_domain ? `// only @${company.allowed_email_domain} addresses` : '// any email address'}</p>
            <div className="space-y-4">
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={company?.allowed_email_domain ? `colleague@${company.allowed_email_domain}` : d.team.emailPlaceholder} className="w-full px-4 py-3 glass rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200/50" />
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
                <button onClick={sendInvite} disabled={inviting || !inviteEmail} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-mono font-semibold hover:shadow-xl disabled:opacity-50 transition-all">{inviting ? 'sending()' : '> send_invite()'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company JD modal */}
      {jdModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-6 z-50" onClick={() => setJdModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-6 max-w-lg w-full border border-gray-200/50">
            <h3 className="font-mono text-sm font-bold mb-4">{jdModal.mode === 'new' ? 'upload_company_jd()' : 'edit_company_jd()'}</h3>
            <div className="space-y-3">
              <input value={jdModal.title} onChange={(e) => setJdModal({ ...jdModal, title: e.target.value })} placeholder="JD title" className="w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
              <textarea value={jdModal.content} onChange={(e) => setJdModal({ ...jdModal, content: e.target.value })} placeholder="Job description content…" rows={8} className="w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => setJdModal(null)} className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono text-xs">close()</button>
                {jdModal.mode === 'edit' && <button onClick={() => deleteJd(jdModal.id!)} className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 font-mono text-xs">delete()</button>}
                <button onClick={saveJd} className="px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono text-xs">{jdModal.mode === 'new' ? 'upload()' : 'save()'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-xs text-gray-500">{label}</span>
      <div className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm text-gray-600">{value}</div>
    </div>
  );
}
