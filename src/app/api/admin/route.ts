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
        const { data, error } = await db.from('companies').update(patch).eq('id', id).select().single();
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
      case 'revoke_user': {
        const { user_id, revoked } = body;
        await db.from('profiles').update({ status: revoked ? 'revoked' : 'active' }).eq('id', user_id);
        return NextResponse.json({ ok: true });
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
        for (const k of ['free_monthly_sessions', 'free_max_jds', 'premium_max_jds']) {
          if (patch?.[k] != null && patch[k] !== '') clean[k] = Number(patch[k]);
        }
        const { data, error } = await db.from('platform_settings').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', 1).select().single();
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
