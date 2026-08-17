import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateEventSignature, getTransaction } from '@/lib/wompi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serviceClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Wompi events webhook. Validates the event checksum, then re-confirms the
 * transaction status via the API before flipping the buyer to premium
 * (idempotent — defends against spoofed events). Source of truth for the plan.
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();
    if (!validateEventSignature(event)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }

    const tx = event?.data?.transaction;
    if (!tx?.id || !tx?.reference) return NextResponse.json({ ok: true, ignored: 'no_transaction' });

    const db = serviceClient();
    // Re-fetch the real status server-side; never trust the event body alone.
    const confirmed = await getTransaction(tx.id);
    const status = confirmed?.status || tx.status;

    // Update the payment row by its unique reference.
    const { data: payment } = await db.from('payments').select('*').eq('reference', tx.reference).single();
    if (!payment) return NextResponse.json({ ok: true, ignored: 'unknown_reference' });

    await db.from('payments').update({ status, transaction_id: tx.id, updated_at: new Date().toISOString() }).eq('reference', tx.reference);

    // Only APPROVED (and amount matches) upgrades the plan. Idempotent.
    if (status === 'APPROVED' && Number(confirmed?.amount_in_cents ?? tx.amount_in_cents) === Number(payment.amount_in_cents) && payment.user_id) {
      await db.from('profiles').update({ plan: 'premium' }).eq('id', payment.user_id);
    }

    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: 'webhook_error', detail: String(e) }, { status: 500 });
  }
}
