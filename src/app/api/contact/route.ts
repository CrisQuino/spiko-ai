import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serviceClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Public Contact-Sales form endpoint. Stores the message for the super-admin inbox. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const company = String(body.company || '').trim() || null;
    const email = String(body.email || '').trim() || null;
    const name = String(body.name || '').trim() || null;

    if (!subject || !message) return NextResponse.json({ error: 'subject_and_message_required' }, { status: 400 });
    if (subject.length > 200 || message.length > 5000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

    const db = serviceClient();
    const { error } = await db.from('contact_messages').insert({ subject, company, email, name, message, status: 'new' });
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'contact_failed', detail: String(e) }, { status: 500 });
  }
}
