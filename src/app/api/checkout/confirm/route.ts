import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTransaction, wompiConfigured } from '@/lib/wompi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serviceClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Synchronous confirmation for the /checkout/return page: reads the REAL
 * transaction status straight from Wompi (authoritative), and — if APPROVED and
 * the transaction maps to THIS user's payment with a matching amount — upgrades
 * the plan idempotently. The webhook remains the backup path; this removes the
 * need to poll the profile waiting for the async event.
 */
export async function POST(request: NextRequest) {
  try {
    if (!wompiConfigured()) return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    const token = authHeader.slice('Bearer '.length);
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'auth_error' }, { status: 401 });

    const { transactionId } = await request.json();
    if (!transactionId) return NextResponse.json({ error: 'missing_transaction_id' }, { status: 400 });

    // Authoritative status from Wompi.
    const tx = await getTransaction(String(transactionId));
    if (!tx) return NextResponse.json({ status: 'UNKNOWN', premium: false });

    const db = serviceClient();
    // The transaction's reference must belong to THIS user's payment.
    const { data: payment } = await db.from('payments').select('*').eq('reference', tx.reference).single();
    const ownedByUser = payment && payment.user_id === user.id;

    if (payment && ownedByUser) {
      await db.from('payments').update({ status: tx.status, transaction_id: tx.id, updated_at: new Date().toISOString() }).eq('reference', tx.reference);
      if (tx.status === 'APPROVED' && Number(tx.amount_in_cents) === Number(payment.amount_in_cents)) {
        await db.from('profiles').update({ plan: 'premium' }).eq('id', user.id); // idempotent
        return NextResponse.json({ status: 'APPROVED', premium: true });
      }
    }

    return NextResponse.json({ status: tx.status, premium: false });
  } catch (e) {
    return NextResponse.json({ error: 'confirm_error', detail: String(e) }, { status: 500 });
  }
}
