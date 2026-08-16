import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Manager team API: a manager manages ONLY their own company. Every action is
// scoped server-side to the caller's company_id (from their profile), so a
// manager can never touch another company. Uses the service role after the
// manager check, centralizing authorization instead of relying on RLS.

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Verify the caller is an active manager and return their company_id.
async function requireManager(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const db = serviceClient();
  const { data: profile } = await db.from('profiles').select('role, company_id, status').eq('id', user.id).single();
  if (!profile || profile.role !== 'manager' || !profile.company_id || profile.status !== 'active') return null;
  return { user, companyId: profile.company_id as string };
}

export async function POST(request: NextRequest) {
  const ctx = await requireManager(request);
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { user, companyId } = ctx;

  const body = await request.json().catch(() => ({}));
  const { action } = body as { action?: string };
  const db = serviceClient();

  try {
    switch (action) {
      case 'overview': {
        const { data: company } = await db.from('companies').select('*').eq('id', companyId).single();
        const { data: members } = await db.from('profiles')
          .select('id, email, full_name, role, status').eq('company_id', companyId);
        const ids = (members || []).map((m: any) => m.id);
        // Per-member completed-session counts.
        const counts: Record<string, number> = {};
        if (ids.length) {
          const { data: costs } = await db.from('lesson_costs').select('user_id').in('user_id', ids);
          (costs || []).forEach((c: any) => { counts[c.user_id] = (counts[c.user_id] || 0) + 1; });
        }
        const withCounts = (members || []).map((m: any) => ({ ...m, sessions: counts[m.id] || 0 }));
        const { data: pending } = await db.from('invitations')
          .select('id, email, role, status, expires_at, created_at')
          .eq('company_id', companyId).eq('status', 'pending')
          .order('created_at', { ascending: false });
        const active = (members || []).filter((m: any) => m.status === 'active').length;
        return NextResponse.json({
          company,
          members: withCounts,
          pending: pending || [],
          seats: { active, pending: (pending || []).length, max: company?.max_users ?? null },
        });
      }

      case 'analytics': {
        // Company-scoped lesson data for the manager dashboard's analytics panels
        // (same shape the super-admin dashboard uses, filtered to this company).
        const { data: members } = await db.from('profiles').select('id').eq('company_id', companyId);
        const ids = (members || []).map((m: any) => m.id);
        if (!ids.length) return NextResponse.json({ lessons: [] });
        const { data } = await db.from('admin_lessons_detail').select('*').in('user_id', ids).order('completed_at', { ascending: false });
        return NextResponse.json({ lessons: data || [] });
      }
      case 'set_domain_mode': {
        // Manager sets their own company's invite-domain policy.
        const mode = body.mode === 'manager' ? 'manager' : 'any';
        let domain: string | null = null;
        if (mode === 'manager') {
          const { data: mgr } = await db.from('profiles').select('email').eq('company_id', companyId).eq('role', 'manager').limit(1).maybeSingle();
          domain = mgr?.email?.includes('@') ? mgr.email.split('@')[1].toLowerCase() : null;
        }
        const { data, error } = await db.from('companies').update({ domain_mode: mode, allowed_email_domain: domain }).eq('id', companyId).select().single();
        if (error) throw error;
        return NextResponse.json({ company: data });
      }
      case 'set_member_role': {
        // Promote/demote a member (co-managers allowed) within THIS company only.
        const { user_id, role } = body as { user_id?: string; role?: string };
        if (!user_id || (role !== 'manager' && role !== 'employee')) return NextResponse.json({ error: 'user_id and role required' }, { status: 400 });
        const { data: target } = await db.from('profiles').select('id, email, company_id').eq('id', user_id).single();
        if (!target || target.company_id !== companyId) return NextResponse.json({ error: 'not_in_team' }, { status: 404 });
        await db.from('profiles').update({ role }).eq('id', user_id);
        if (role === 'manager' && target.email?.includes('@')) {
          const { data: comp } = await db.from('companies').select('domain_mode').eq('id', companyId).single();
          if (comp?.domain_mode === 'manager') {
            await db.from('companies').update({ allowed_email_domain: target.email.split('@')[1].toLowerCase() }).eq('id', companyId);
          }
        }
        return NextResponse.json({ ok: true, role });
      }
      case 'list_company_jds': {
        const { data } = await db.from('job_descriptions').select('id, title, content, created_at').eq('company_id', companyId).eq('visibility', 'company').order('created_at', { ascending: false });
        return NextResponse.json({ jds: data || [] });
      }
      case 'upload_company_jd': {
        const { title, content } = body;
        if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: 'title, content required' }, { status: 400 });
        const { data, error } = await db.from('job_descriptions').insert({ user_id: user.id, company_id: companyId, title: title.trim(), content: content.trim(), visibility: 'company' }).select().single();
        if (error) throw error;
        return NextResponse.json({ jd: data });
      }
      case 'update_company_jd': {
        const { id, title, content } = body;
        if (!id || !title?.trim() || !content?.trim()) return NextResponse.json({ error: 'id, title, content required' }, { status: 400 });
        const { data, error } = await db.from('job_descriptions').update({ title: title.trim(), content: content.trim() }).eq('id', id).eq('company_id', companyId).eq('visibility', 'company').select().single();
        if (error) throw error;
        return NextResponse.json({ jd: data });
      }
      case 'delete_company_jd': {
        const { id } = body;
        await db.from('job_descriptions').delete().eq('id', id).eq('company_id', companyId).eq('visibility', 'company');
        return NextResponse.json({ ok: true });
      }
      case 'list_member_jds': {
        // Personal JDs by this company's members — candidates to promote team-wide.
        const { data: members } = await db.from('profiles').select('id, email').eq('company_id', companyId);
        const ids = (members || []).map((m: any) => m.id);
        if (!ids.length) return NextResponse.json({ jds: [] });
        const emap = new Map((members || []).map((m: any) => [m.id, m.email]));
        const { data } = await db.from('job_descriptions').select('id, title, user_id, created_at').in('user_id', ids).eq('visibility', 'personal').order('created_at', { ascending: false });
        const jds = (data || []).map((j: any) => ({ id: j.id, title: j.title, owner_email: emap.get(j.user_id) || null, created_at: j.created_at }));
        return NextResponse.json({ jds });
      }
      case 'promote_jd': {
        // Promote a member's personal JD to a team-wide company JD (own company only).
        const { id } = body;
        const { data: jd } = await db.from('job_descriptions').select('user_id').eq('id', id).single();
        if (!jd) return NextResponse.json({ error: 'jd_not_found' }, { status: 404 });
        const { data: owner } = await db.from('profiles').select('company_id').eq('id', jd.user_id).single();
        if (!owner || owner.company_id !== companyId) return NextResponse.json({ error: 'not_in_team' }, { status: 403 });
        await db.from('job_descriptions').update({ visibility: 'company', company_id: companyId }).eq('id', id);
        return NextResponse.json({ ok: true });
      }

      case 'invite_member': {
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: 'valid email required' }, { status: 400 });
        }
        const { data: company } = await db.from('companies').select('*').eq('id', companyId).single();
        if (!company) return NextResponse.json({ error: 'company_missing' }, { status: 400 });
        if (company.status === 'suspended') return NextResponse.json({ error: 'company_suspended' }, { status: 403 });

        // Same-domain rule (only enforced when the company restricts a domain).
        const domain = (company.allowed_email_domain || '').trim().toLowerCase();
        if (domain && !email.endsWith(`@${domain}`)) {
          return NextResponse.json({ error: 'domain_mismatch', domain }, { status: 400 });
        }

        // Already a member?
        const { data: existing } = await db.from('profiles').select('id').eq('company_id', companyId).ilike('email', email).maybeSingle();
        if (existing) return NextResponse.json({ error: 'already_member' }, { status: 409 });
        // Already invited?
        const { data: dupInvite } = await db.from('invitations').select('id').eq('company_id', companyId).eq('email', email).eq('status', 'pending').maybeSingle();
        if (dupInvite) return NextResponse.json({ error: 'already_invited' }, { status: 409 });

        // Seat check: active members + pending invites must be below the cap.
        const { count: active } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active');
        const { count: pending } = await db.from('invitations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending');
        if (company.max_users != null && (active || 0) + (pending || 0) >= company.max_users) {
          return NextResponse.json({ error: 'seats_full', max: company.max_users }, { status: 409 });
        }

        // Managers invite team members (employees); only a super-admin can seat a manager.
        const { data: invitation, error } = await db.from('invitations').insert({
          company_id: companyId, email, role: 'employee', status: 'pending',
          token: crypto.randomUUID(), invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ invitation });
      }

      case 'cancel_invite': {
        const { invitation_id } = body;
        await db.from('invitations').delete().eq('id', invitation_id).eq('company_id', companyId).eq('status', 'pending');
        return NextResponse.json({ ok: true });
      }

      case 'remove_member': {
        // B2B off-boarding: remove a member from the team. They revert to a free
        // individual (B2C) — company_id cleared, plan free. To re-add, re-invite.
        const { user_id } = body;
        if (user_id === user.id) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
        // Only a member of THIS company, and never another manager.
        const { data: target } = await db.from('profiles').select('id, role, company_id').eq('id', user_id).single();
        if (!target || target.company_id !== companyId) return NextResponse.json({ error: 'not_in_team' }, { status: 404 });
        if (target.role === 'manager') return NextResponse.json({ error: 'cannot_remove_manager' }, { status: 403 });
        await db.from('profiles').update({ company_id: null, plan: 'free', role: 'employee', status: 'active' }).eq('id', user_id);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[team api]', action, e?.message);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
