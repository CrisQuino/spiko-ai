import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Invitation acceptance. GET returns public invitation info for the landing
// page (no auth); POST accepts it for the authenticated user. Both run with the
// service role because a freshly-signed-up user's RLS can't yet read the
// invitation or update their own company_id, and acceptance must validate the
// token server-side (email match, expiry, seat availability).

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  return user || null;
}

function invitationState(inv: { status: string; expires_at: string } | null): { valid: boolean; reason?: string } {
  if (!inv) return { valid: false, reason: 'invalid' };
  if (inv.status !== 'pending') return { valid: false, reason: 'used' };
  if (new Date(inv.expires_at) < new Date()) return { valid: false, reason: 'expired' };
  return { valid: true };
}

// Public info for the invite landing page.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
  const db = serviceClient();
  const { data: inv } = await db.from('invitations').select('email, role, status, expires_at, company_id').eq('token', token).single();
  if (!inv) return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 404 });
  const { data: company } = await db.from('companies').select('name, status').eq('id', inv.company_id).single();
  const state = invitationState(inv);
  return NextResponse.json({
    email: inv.email,
    role: inv.role,
    expires_at: inv.expires_at,
    status: inv.status,
    company_name: company?.name || null,
    company_suspended: company?.status === 'suspended',
    ...state,
  });
}

// Accept for the authenticated user.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !user.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { token } = await request.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const db = serviceClient();
  const { data: inv } = await db.from('invitations').select('*').eq('token', token).single();
  const state = invitationState(inv);
  if (!state.valid) return NextResponse.json({ error: state.reason }, { status: 400 });

  // The invite is bound to a specific email — the signed-in user must match it.
  if (inv!.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'email_mismatch', invited: inv!.email }, { status: 403 });
  }

  const { data: company } = await db.from('companies').select('id, name, status, max_users').eq('id', inv!.company_id).single();
  if (!company) return NextResponse.json({ error: 'company_missing' }, { status: 400 });
  if (company.status === 'suspended') return NextResponse.json({ error: 'company_suspended' }, { status: 403 });

  const { count: active } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'active');
  if ((active || 0) >= (company.max_users ?? 2147483647)) {
    return NextResponse.json({ error: 'company_full' }, { status: 403 });
  }

  const { error: pErr } = await db.from('profiles')
    .update({ company_id: company.id, role: inv!.role, plan: 'corporate', status: 'active' })
    .eq('id', user.id);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  await db.from('invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', inv!.id);

  return NextResponse.json({ ok: true, company: { id: company.id, name: company.name }, role: inv!.role });
}
