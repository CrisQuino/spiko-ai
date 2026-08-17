import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Server-side super-admin API: verifies the caller is the super-admin, then
// performs privileged mutations with the service role (never exposed to the
// client). Centralizes authorization instead of scattering RLS policies.
// Super-admin allowlist. Defaults to the owner; overridable via env (used to
// add a test admin locally without touching the real account — never set the
// test address in production).
const SUPER_ADMINS = (process.env.SUPER_ADMIN_EMAILS || 'dash.crs@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireSuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || !user.email || !SUPER_ADMINS.includes(user.email.toLowerCase())) return null;
  return user;
}

export async function POST(request: NextRequest) {
  const user = await requireSuperAdmin(request);
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { action } = body as { action?: string };
  const db = serviceClient();

  try {
    switch (action) {
      case 'list_companies': {
        const { data: companies } = await db.from('companies').select('*').order('created_at', { ascending: false });
        // attach live member/seat counts
        const withCounts = await Promise.all((companies || []).map(async (c: any) => {
          const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', c.id);
          const { count: pending } = await db.from('invitations').select('id', { count: 'exact', head: true }).eq('company_id', c.id).eq('status', 'pending');
          return { ...c, members: count || 0, pending_invites: pending || 0 };
        }));
        return NextResponse.json({ companies: withCounts });
      }
      case 'create_company': {
        const { name, allowed_email_domain, max_users, daily_practice_limit, monthly_practice_limit, max_jds_per_user } = body;
        if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
        const slug = `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 6)}`;
        const { data, error } = await db.from('companies').insert({
          name: name.trim(), slug, plan: 'corporate', status: 'active', created_by: user.id,
          allowed_email_domain: allowed_email_domain?.trim() || null,
          max_users: Number(max_users) || 5,
          daily_practice_limit: daily_practice_limit === '' || daily_practice_limit == null ? null : Number(daily_practice_limit),
          monthly_practice_limit: monthly_practice_limit === '' || monthly_practice_limit == null ? null : Number(monthly_practice_limit),
          max_jds_per_user: max_jds_per_user === '' || max_jds_per_user == null ? null : Number(max_jds_per_user),
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ company: data });
      }
      case 'update_company': {
        const { id, patch } = body;
        const p = { ...patch };
        // Domain policy: 'any' clears the filter; 'manager' derives it from the
        // company's current manager (blank until one is assigned).
        if (p.domain_mode === 'any') {
          p.allowed_email_domain = null;
        } else if (p.domain_mode === 'manager') {
          const { data: mgr } = await db.from('profiles').select('email').eq('company_id', id).eq('role', 'manager').limit(1).maybeSingle();
          p.allowed_email_domain = mgr?.email?.includes('@') ? mgr.email.split('@')[1].toLowerCase() : null;
        }
        const { data, error } = await db.from('companies').update(p).eq('id', id).select().single();
        if (error) throw error;
        return NextResponse.json({ company: data });
      }
      case 'suspend_company': {
        const { id, suspended } = body;
        await db.from('companies').update({ status: suspended ? 'suspended' : 'active' }).eq('id', id);
        return NextResponse.json({ ok: true });
      }
      case 'delete_company': {
        const { id } = body;
        await db.from('profiles').update({ company_id: null, plan: 'free', role: 'employee' }).eq('company_id', id);
        await db.from('job_descriptions').delete().eq('company_id', id);
        await db.from('invitations').delete().eq('company_id', id);
        await db.from('companies').delete().eq('id', id);
        return NextResponse.json({ ok: true });
      }
      case 'invite_manager': {
        const { company_id, email } = body;
        if (!company_id || !email?.trim()) return NextResponse.json({ error: 'company_id and email required' }, { status: 400 });
        const { data, error } = await db.from('invitations').insert({
          company_id, email: String(email).trim().toLowerCase(), role: 'manager', status: 'pending',
          token: crypto.randomUUID(), invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ invitation: data });
      }
      case 'list_members': {
        const { company_id } = body;
        const { data } = await db.from('profiles').select('id, email, full_name, role, status').eq('company_id', company_id);
        const { data: invites } = await db.from('invitations').select('id, email, role, status, expires_at').eq('company_id', company_id).eq('status', 'pending');
        return NextResponse.json({ members: data || [], pending: invites || [] });
      }
      case 'remove_from_company': {
        // B2B off-boarding: detach the member from the company. They revert to a
        // normal free individual (B2C) — not banned, just no longer corporate.
        const { user_id } = body;
        await db.from('profiles').update({ company_id: null, plan: 'free', role: 'employee', status: 'active' }).eq('id', user_id);
        return NextResponse.json({ ok: true });
      }
      case 'ban_user': {
        // B2C revocation: block the account from logging in at all (reversible).
        // Accepts an email (resolved via profiles) or a user_id. Validates that
        // the account exists and isn't already in the requested state.
        const { email, user_id, banned } = body as { email?: string; user_id?: string; banned?: boolean };
        let id = user_id;
        if (!id && email) {
          const { data: p } = await db.from('profiles').select('id').ilike('email', String(email).trim()).maybeSingle();
          if (!p) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
          id = p.id;
        }
        if (!id) return NextResponse.json({ error: 'email or user_id required' }, { status: 400 });
        const { data: got, error: getErr } = await db.auth.admin.getUserById(id);
        if (getErr || !got?.user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
        const bu = (got.user as any).banned_until as string | null | undefined;
        const isBanned = !!bu && new Date(bu) > new Date();
        if (banned && isBanned) return NextResponse.json({ error: 'already_banned' }, { status: 409 });
        if (!banned && !isBanned) return NextResponse.json({ error: 'not_banned' }, { status: 409 });
        const { error } = await db.auth.admin.updateUserById(id, { ban_duration: banned ? '876000h' : 'none' });
        if (error) throw error;
        return NextResponse.json({ ok: true, banned: !!banned });
      }
      case 'delete_user': {
        // Hard reset of a B2C individual: fully delete the account (cascades the
        // profile + lesson history, so their monthly free-session count resets).
        // Guarded to non-corporate accounts — corporate members are managed from
        // their company panel.
        const { user_id } = body as { user_id?: string };
        if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
        const { data: prof } = await db.from('profiles').select('company_id').eq('id', user_id).maybeSingle();
        if (prof?.company_id) return NextResponse.json({ error: 'user_is_corporate' }, { status: 409 });
        const { error } = await db.auth.admin.deleteUser(user_id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'list_users': {
        // All users for the ban/unban picker (login access applies to anyone,
        // corporate or B2C), annotated with ban state, plan, and company name.
        // Case-insensitive email search; capped for the picker.
        const { search } = body as { search?: string };
        let q = db.from('profiles').select('id, email, full_name, plan, company_id, companies(name)').order('email').limit(100);
        if (search?.trim()) q = q.ilike('email', `%${search.trim()}%`);
        const { data: profs } = await q;
        // Map ban state from Auth (paginated; covers current scale).
        const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const banMap = new Map<string, boolean>();
        for (const u of list?.users || []) {
          const bu = (u as any).banned_until as string | null | undefined;
          banMap.set(u.id, !!bu && new Date(bu) > new Date());
        }
        const users = (profs || []).map((p: any) => ({
          id: p.id, email: p.email, full_name: p.full_name, plan: p.plan,
          company: p.companies?.name || null, company_id: p.company_id || null,
          banned: banMap.get(p.id) || false,
        }));
        return NextResponse.json({ users });
      }
      case 'list_company_jds': {
        const { company_id } = body;
        const { data } = await db.from('job_descriptions')
          .select('id, title, content, created_at')
          .eq('company_id', company_id).eq('visibility', 'company')
          .order('created_at', { ascending: false });
        return NextResponse.json({ jds: data || [] });
      }
      case 'update_company_jd': {
        const { id, title, content } = body;
        if (!id || !title?.trim() || !content?.trim()) return NextResponse.json({ error: 'id, title, content required' }, { status: 400 });
        const { data, error } = await db.from('job_descriptions')
          .update({ title: title.trim(), content: content.trim() })
          .eq('id', id).eq('visibility', 'company').select().single();
        if (error) throw error;
        return NextResponse.json({ jd: data });
      }
      case 'delete_company_jd': {
        const { id } = body;
        await db.from('job_descriptions').delete().eq('id', id).eq('visibility', 'company');
        return NextResponse.json({ ok: true });
      }
      case 'list_member_jds': {
        // Personal JDs created by a company's members — candidates to promote to
        // the whole team.
        const { company_id } = body;
        const { data: members } = await db.from('profiles').select('id, email').eq('company_id', company_id);
        const ids = (members || []).map((m: any) => m.id);
        if (!ids.length) return NextResponse.json({ jds: [] });
        const emap = new Map((members || []).map((m: any) => [m.id, m.email]));
        const { data } = await db.from('job_descriptions').select('id, title, user_id, created_at').in('user_id', ids).eq('visibility', 'personal').order('created_at', { ascending: false });
        const jds = (data || []).map((j: any) => ({ id: j.id, title: j.title, owner_email: emap.get(j.user_id) || null, created_at: j.created_at }));
        return NextResponse.json({ jds });
      }
      case 'promote_jd': {
        // Promote a member's personal JD to a team-wide company JD.
        const { id, company_id } = body;
        const { data: jd } = await db.from('job_descriptions').select('user_id').eq('id', id).single();
        if (!jd) return NextResponse.json({ error: 'jd_not_found' }, { status: 404 });
        const { data: owner } = await db.from('profiles').select('company_id').eq('id', jd.user_id).single();
        if (!owner || owner.company_id !== company_id) return NextResponse.json({ error: 'not_in_company' }, { status: 403 });
        await db.from('job_descriptions').update({ visibility: 'company', company_id }).eq('id', id);
        return NextResponse.json({ ok: true });
      }
      case 'set_member_role': {
        // Promote/demote an EXISTING company member between manager and employee.
        // This is how a company created before the invite flow (or any company)
        // gets — or changes — its manager. The manager's own email domain becomes
        // the company's invitation filter, so new invites must match it.
        const { user_id, role } = body as { user_id?: string; role?: string };
        if (!user_id || (role !== 'manager' && role !== 'employee')) {
          return NextResponse.json({ error: 'user_id and role (manager|employee) required' }, { status: 400 });
        }
        const { data: target } = await db.from('profiles').select('id, email, company_id, role').eq('id', user_id).single();
        if (!target || !target.company_id) return NextResponse.json({ error: 'not_in_company' }, { status: 404 });
        await db.from('profiles').update({ role }).eq('id', user_id);
        let domain: string | null = null;
        // Only auto-set the invite domain when the company follows its manager.
        if (role === 'manager' && target.email?.includes('@')) {
          const { data: comp } = await db.from('companies').select('domain_mode').eq('id', target.company_id).single();
          if (comp?.domain_mode === 'manager') {
            domain = target.email.split('@')[1].toLowerCase();
            await db.from('companies').update({ allowed_email_domain: domain }).eq('id', target.company_id);
          }
        }
        return NextResponse.json({ ok: true, role, allowed_email_domain: domain });
      }
      case 'upload_company_jd': {
        const { company_id, title, content } = body;
        if (!company_id || !title?.trim() || !content?.trim()) return NextResponse.json({ error: 'company_id, title, content required' }, { status: 400 });
        const { data, error } = await db.from('job_descriptions').insert({
          user_id: user.id, company_id, title: title.trim(), content: content.trim(), visibility: 'company',
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ jd: data });
      }
      case 'get_settings': {
        const { data } = await db.from('platform_settings').select('*').eq('id', 1).single();
        return NextResponse.json({ settings: data });
      }
      case 'update_settings': {
        const { patch } = body;
        const clean: Record<string, number> = {};
        for (const k of ['free_monthly_sessions', 'free_max_jds', 'premium_max_jds', 'margin_pct']) {
          if (patch?.[k] != null && patch[k] !== '') clean[k] = Number(patch[k]);
        }
        const cleanAll: Record<string, number | boolean> = { ...clean };
        if (patch?.free_dashboard_enabled != null) cleanAll.free_dashboard_enabled = !!patch.free_dashboard_enabled;
        const { data, error } = await db.from('platform_settings').update({ ...cleanAll, updated_at: new Date().toISOString() }).eq('id', 1).select().single();
        if (error) throw error;
        return NextResponse.json({ settings: data });
      }
      default:
        return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[admin api]', action, e?.message);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
