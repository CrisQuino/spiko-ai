import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serviceClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function loadInvite(db: ReturnType<typeof serviceClient>, token: string) {
  const { data } = await db.from('interview_invites').select('*').eq('token', token).single();
  return data;
}
const isExpired = (inv: any) => inv?.expires_at && new Date(inv.expires_at) < new Date();

/** Public: candidate opens the tokenized interview (no login). Returns the config
 *  the run needs + the company's transcript policy. Never leaks other invites. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const db = serviceClient();
  const inv = await loadInvite(db, params.token);
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (isExpired(inv)) return NextResponse.json({ error: 'expired' }, { status: 410 });
  const { data: company } = await db.from('companies').select('name, transcript_policy').eq('id', inv.company_id).single();
  return NextResponse.json({
    ok: true,
    company_name: company?.name || null,
    transcript_policy: company?.transcript_policy || 'default',
    candidate_email: inv.candidate_email,
    candidate_name: inv.candidate_name,
    language: inv.language,
    level: inv.level,
    jd_title: inv.jd_title,
    jd_content: inv.jd_content,
    status: inv.status,
  });
}

/** Public: mark the interview started, or store its result on completion. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const db = serviceClient();
  const inv = await loadInvite(db, params.token);
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (isExpired(inv)) return NextResponse.json({ error: 'expired' }, { status: 410 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === 'start') {
    if (inv.status === 'sent') {
      await db.from('interview_invites').update({ status: 'started', started_at: new Date().toISOString() }).eq('token', params.token);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'complete') {
    if (inv.status === 'completed') return NextResponse.json({ ok: true, already: true });
    const r = body.result || {};
    const num = (v: any) => (v == null || v === '' ? null : Math.round(Number(v)));
    await db.from('interview_invites').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      cefr_overall: r.cefr_overall || null,
      pronunciation_score: num(r.pronunciation_score),
      fluency_score: num(r.fluency_score),
      vocabulary_score: num(r.vocabulary_score),
      grammar_score: num(r.grammar_score),
      interaction_score: num(r.interaction_score),
      comprehension_score: num(r.comprehension_score),
      overall_score: num(r.overall_score),
      final_feedback: r.final_feedback || null,
      transcript: r.transcript ?? null,
    }).eq('token', params.token);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
