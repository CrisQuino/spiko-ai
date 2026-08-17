import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { buildCheckoutUrl, wompiConfigured, PREMIUM_AMOUNT_CENTS, MIN_AMOUNT_CENTS, CURRENCY } from '@/lib/wompi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serviceClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Starts a Wompi Web-Checkout for the B2C premium plan. The integrity signature
 * is computed server-side so the secret never ships. Returns { url } to redirect.
 */
export async function POST(request: NextRequest) {
  try {
    if (!wompiConfigured()) {
      return NextResponse.json({ error: 'payments_not_configured', message: 'Wompi keys are not set yet.' }, { status: 503 });
    }

    // Authenticate the buyer via Bearer token.
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    const token = authHeader.slice('Bearer '.length);
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'auth_error' }, { status: 401 });

    const amountInCents = PREMIUM_AMOUNT_CENTS;
    if (amountInCents < MIN_AMOUNT_CENTS) return NextResponse.json({ error: 'amount_too_low' }, { status: 400 });

    // Unique reference; persist a PENDING row (service role bypasses RLS).
    const reference = `spiko-${user.id.slice(0, 8)}-${crypto.randomUUID().slice(0, 12)}`;
    const db = serviceClient();
    const { error: insErr } = await db.from('payments').insert({
      reference, user_id: user.id, email: user.email, amount_in_cents: amountInCents, currency: CURRENCY, status: 'PENDING',
    });
    if (insErr) return NextResponse.json({ error: 'db_error', detail: insErr.message }, { status: 500 });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const url = buildCheckoutUrl({
      reference, amountInCents, redirectUrl: `${origin}/checkout/return`, customerEmail: user.email || undefined,
    });
    return NextResponse.json({ url, reference });
  } catch (e) {
    return NextResponse.json({ error: 'checkout_failed', detail: String(e) }, { status: 500 });
  }
}
