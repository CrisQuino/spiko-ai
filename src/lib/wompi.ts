/**
 * Wompi (Colombia) payment helpers — server-only.
 *
 * Credentials come from env (never shipped to the browser except the public key):
 *   WOMPI_ENV                  'sandbox' | 'production'   (default sandbox)
 *   WOMPI_PUBLIC_KEY           pub_test_… / pub_prod_…    (checkout param + GET tx)
 *   WOMPI_PRIVATE_KEY          prv_test_… / prv_prod_…    (server only)
 *   WOMPI_INTEGRITY_SECRET     test_integrity_… / prod_…  (server only — checkout signature)
 *   WOMPI_EVENTS_SECRET        test_events_… / prod_…     (server only — webhook checksum)
 *   WOMPI_PREMIUM_AMOUNT_CENTS integer COP centavos for the B2C premium plan
 *
 * Docs: https://docs.wompi.co  (ambientes-y-llaves, widget-checkout-web, eventos, transacciones)
 */
import crypto from 'node:crypto';

export const WOMPI_ENV = (process.env.WOMPI_ENV || 'sandbox') === 'production' ? 'production' : 'sandbox';
export const WOMPI_API_URL = WOMPI_ENV === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
export const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';
export const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
const INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';

export const CURRENCY = 'COP';
export const MIN_AMOUNT_CENTS = 150000; // Wompi platform minimum ≈ 1.500 COP
export const PREMIUM_AMOUNT_CENTS = Number(process.env.WOMPI_PREMIUM_AMOUNT_CENTS || 4900000); // 49.000 COP default

/** All secrets present → the integration is live. Otherwise the UI degrades to "coming soon". */
export function wompiConfigured(): boolean {
  return !!(WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY && INTEGRITY_SECRET && EVENTS_SECRET);
}

/** SHA-256( reference + amountInCents + currency + [expirationTime] + integritySecret ), lowercase hex. */
export function integritySignature(reference: string, amountInCents: number, currency = CURRENCY, expirationTime?: string): string {
  const base = `${reference}${amountInCents}${currency}${expirationTime || ''}${INTEGRITY_SECRET}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

/** Build the redirect Web-Checkout URL for a one-time payment. */
export function buildCheckoutUrl(opts: { reference: string; amountInCents: number; redirectUrl: string; customerEmail?: string }): string {
  const params = new URLSearchParams({
    'public-key': WOMPI_PUBLIC_KEY,
    currency: CURRENCY,
    'amount-in-cents': String(opts.amountInCents),
    reference: opts.reference,
    'signature:integrity': integritySignature(opts.reference, opts.amountInCents),
    'redirect-url': opts.redirectUrl,
  });
  if (opts.customerEmail) params.set('customer-data:email', opts.customerEmail);
  return `${WOMPI_CHECKOUT_URL}?${params.toString()}`;
}

type WompiEvent = {
  data?: Record<string, unknown>;
  timestamp?: number;
  signature?: { properties?: string[]; checksum?: string };
};

/** Validate an incoming webhook: SHA-256( ...props(in order) + timestamp + eventsSecret ). Case-insensitive. */
export function validateEventSignature(event: WompiEvent): boolean {
  const props = event?.signature?.properties || [];
  if (!props.length || !event?.signature?.checksum) return false;
  const resolve = (path: string) => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), event.data);
  const concatenated = props.map((p) => String(resolve(p) ?? '')).join('');
  const base = `${concatenated}${event.timestamp}${EVENTS_SECRET}`;
  const checksum = crypto.createHash('sha256').update(base).digest('hex');
  return checksum.toLowerCase() === String(event.signature.checksum).toLowerCase();
}

/** Fetch a transaction to confirm its real status server-side (never trust the redirect alone). */
export async function getTransaction(id: string): Promise<{ id: string; reference: string; status: string; amount_in_cents: number } | null> {
  try {
    const r = await fetch(`${WOMPI_API_URL}/transactions/${id}`, { headers: { Authorization: `Bearer ${WOMPI_PUBLIC_KEY}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data || null;
  } catch {
    return null;
  }
}
