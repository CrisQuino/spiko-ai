'use client';

import { useEffect, useState } from 'react';
import { supabase, channelOf, type Channel } from '@/lib/supabase';
import { getAdminLessons, type AdminLesson } from '@/lib/admin-queries';

const CHANNEL_LABEL: Record<Channel, string> = { free: 'Free', b2c: 'B2C', b2b: 'B2B' };
const CHANNEL_BADGE: Record<Channel, string> = { free: 'bg-gray-100 text-gray-600', b2c: 'bg-emerald-100 text-emerald-700', b2b: 'bg-indigo-100 text-indigo-700' };
import { useUi, LanguageSwitcher } from '@/lib/ui-i18n';
import DashboardAnalytics from '@/components/DashboardAnalytics';

// Client-side super-admin allowlist for the dashboard gate. This is UX only —
// the real authorization is server-side (the /api/admin route + RLS). Defaults
// to the owner; an optional public env can add a test admin locally.
const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || 'dash.crs@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isSuperAdmin = (email?: string | null) => !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

export default function AdminDashboard() {
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const { d } = useUi();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

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
        <div className="flex items-center gap-3 flex-wrap"><LanguageSwitcher /></div>
      </div>

      <DashboardAnalytics lessons={lessons} />

      {/* Super-admin: companies + platform settings management */}
      <SuperAdminPanel />
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
type Settings = { free_monthly_sessions: number; free_max_jds: number; premium_max_jds: number; margin_pct: number; free_dashboard_enabled: boolean };
type CompanyJd = { id: string; title: string; content: string; created_at: string };
type ApiFn = (action: string, params?: Record<string, unknown>) => Promise<{ status: number; body: any }>;

const num = (v: string) => (v === '' ? null : Number(v));
const lim = (v: number | null) => (v == null ? '∞' : String(v));

function SuperAdminPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sDraft, setSDraft] = useState({ free_monthly_sessions: '', free_max_jds: '', premium_max_jds: '', margin_pct: '' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { members: Member[]; pending: Pending[] }>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', allowed_email_domain: '', max_users: '5', daily_practice_limit: '', monthly_practice_limit: '', max_jds_per_user: '' });
  const [banQuery, setBanQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');
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
        margin_pct: String(s.body.settings.margin_pct ?? ''),
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

  const toggleFreeDashboard = async (enabled: boolean) => {
    const r = await api('update_settings', { patch: { free_dashboard_enabled: enabled } });
    if (r.status === 200) { setSettings(r.body.settings); flash(enabled ? '✓ free users can enter the dashboard' : '✓ free users are gated (paywall)'); }
    else flash(`✕ ${r.body?.error || 'error'}`);
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {([
            ['free_monthly_sessions', 'Free sessions / month'],
            ['free_max_jds', 'Free max JDs'],
            ['premium_max_jds', 'Premium max JDs'],
            ['margin_pct', 'Margin % (team price)'],
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
              live: {settings.free_monthly_sessions}/mo · {settings.free_max_jds} free JDs · {settings.premium_max_jds} premium JDs · {settings.margin_pct}% margin
            </span>
          )}
        </div>
        {/* Free-user dashboard access toggle */}
        {settings && (
          <div className="mt-4 flex items-center justify-between gap-3 bg-white/60 border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <p className="font-mono text-sm text-gray-700">free_dashboard_access</p>
              <p className="font-mono text-xs text-gray-400">{settings.free_dashboard_enabled ? 'Free users can enter the dashboard.' : 'Free users see the subscribe paywall.'}</p>
            </div>
            <button
              role="switch"
              aria-checked={settings.free_dashboard_enabled}
              onClick={() => toggleFreeDashboard(!settings.free_dashboard_enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${settings.free_dashboard_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.free_dashboard_enabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        )}
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
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={banQuery} onChange={(e) => setBanQuery(e.target.value)}
            placeholder="type to search by email… (blank = all users)"
            className="flex-1 min-w-[220px] bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm"
          />
          <div className="flex gap-1 items-center">
            {(['all', 'free', 'b2c', 'b2b'] as const).map((c) => (
              <button key={c} onClick={() => setChannelFilter(c)} className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${channelFilter === c ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white' : 'bg-white/60 text-gray-600 hover:bg-white'}`}>{c === 'all' ? 'All' : CHANNEL_LABEL[c]}</button>
            ))}
          </div>
          <span className="font-mono text-xs text-gray-400 shrink-0">{b2cLoading ? 'searching…' : b2cUsers ? `${b2cUsers.filter((u) => channelFilter === 'all' || channelOf(u) === channelFilter).length} shown` : ''}</span>
        </div>
        {b2cUsers && (
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1 pr-1">
            {(() => { const shown = b2cUsers.filter((u) => channelFilter === 'all' || channelOf(u) === channelFilter); return <>
            {shown.length === 0 && <p className="font-mono text-xs text-gray-400">// no_users_match</p>}
            {shown.map((u) => (
              <div key={u.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md font-mono text-xs ${u.company ? 'bg-indigo-50' : 'bg-white/60'}`}>
                <span className="truncate min-w-0">
                  {u.email}
                  <span className={`ml-2 px-1.5 py-0.5 rounded ${CHANNEL_BADGE[channelOf(u)]}`}>{CHANNEL_LABEL[channelOf(u)]}</span>
                  {u.company && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">in {u.company}</span>}
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
            </>; })()}
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
  const [memberJds, setMemberJds] = useState<{ id: string; title: string; owner_email: string | null; created_at: string }[]>([]);
  const [jdModal, setJdModal] = useState<null | { mode: 'new' | 'edit'; id?: string; title: string; content: string }>(null);
  const loadJds = async () => { const r = await api('list_company_jds', { company_id: c.id }); setJds(r.body?.jds || []); };
  const loadMemberJds = async () => { const r = await api('list_member_jds', { company_id: c.id }); setMemberJds(r.body?.jds || []); };
  useEffect(() => { loadJds(); loadMemberJds(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [c.id]);
  const promoteJd = async (jdId: string) => {
    const r = await api('promote_jd', { id: jdId, company_id: c.id });
    if (r.status === 200) { flash('✓ JD promoted — now shared with the whole team'); loadJds(); loadMemberJds(); }
    else flash(`✕ ${r.body?.error || 'error'}`);
  };
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

      {/* Members' personal JDs — promote any to the whole team */}
      <div>
        <h4 className="font-mono text-xs text-gray-500 mb-2">member_jds() [{memberJds.length}] <span className="text-gray-400">— members&apos; personal JDs; promote one to share with the whole team</span></h4>
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
