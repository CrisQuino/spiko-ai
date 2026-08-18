'use client';

/**
 * Where Wompi sends the buyer back after Web-Checkout (?id=<transactionId>).
 * We read the REAL transaction status straight from Wompi (via /api/checkout/
 * confirm) — no eternal polling of the profile. When Wompi says APPROVED the
 * plan is upgraded synchronously; the webhook is only the backup path.
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type State = 'checking' | 'approved' | 'declined' | 'pending' | 'noauth';

function ReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const txId = params.get('id');
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    if (!txId) { setState('pending'); return; }
    let cancelled = false;
    let tries = 0;
    const run = async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState('noauth'); return; }
      try {
        const res = await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ transactionId: txId }),
        });
        const j = await res.json();
        if (cancelled) return;
        if (j.premium || j.status === 'APPROVED') { setState('approved'); return; }
        if (['DECLINED', 'ERROR', 'VOIDED'].includes(j.status)) { setState('declined'); return; }
      } catch { /* keep polling */ }
      // Still PENDING at Wompi — retry a bounded number of times, then hand off
      // to the webhook (which finalizes the upgrade whenever the event lands).
      if (++tries >= 15) { setState('pending'); return; }
      setTimeout(run, 4000);
    };
    run();
    return () => { cancelled = true; };
  }, [txId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/30 to-cyan-50/30 px-6">
      <div className="w-full max-w-md glass rounded-3xl border border-gray-200/60 shadow-2xl p-8 text-center">
        {state === 'checking' && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <h1 className="font-mono font-bold text-xl gradient-text mb-1">confirmando_pago()</h1>
            <p className="font-mono text-xs text-gray-500">Consultando el estado en Wompi…</p>
          </>
        )}
        {state === 'approved' && (
          <>
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="font-mono font-bold text-2xl gradient-text mb-2">¡Bienvenido a premium!</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">Tu dashboard completo ya está desbloqueado.</p>
            <button onClick={() => router.push('/dashboard')} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white font-mono font-semibold hover:shadow-xl transition-all">&gt; go_to_dashboard()</button>
          </>
        )}
        {state === 'declined' && (
          <>
            <div className="text-5xl mb-3">❌</div>
            <h1 className="font-mono font-bold text-xl text-gray-800 mb-2">pago_rechazado()</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">La transacción no fue aprobada. Puedes intentarlo de nuevo.</p>
            <Link href="/dashboard" className="block w-full py-3 rounded-xl glass border-2 border-gray-300 text-gray-700 font-mono font-semibold hover:border-cyan-500 transition-all">&gt; volver()</Link>
          </>
        )}
        {state === 'pending' && (
          <>
            <div className="text-5xl mb-3">⏳</div>
            <h1 className="font-mono font-bold text-xl text-gray-800 mb-2">pago_en_proceso()</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">Wompi aún está confirmando la transacción. En cuanto se apruebe, tu cuenta se actualizará automáticamente{txId ? ` (tx: ${txId.slice(0, 10)}…)` : ''}.</p>
            <Link href="/dashboard" className="block w-full py-3 rounded-xl glass border-2 border-gray-300 text-gray-700 font-mono font-semibold hover:border-cyan-500 transition-all">&gt; back_to_dashboard()</Link>
          </>
        )}
        {state === 'noauth' && (
          <>
            <div className="text-5xl mb-3">🔐</div>
            <h1 className="font-mono font-bold text-xl text-gray-800 mb-2">sesión_expirada()</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">Tu pago se está procesando. Inicia sesión de nuevo para ver tu cuenta actualizada.</p>
            <Link href="/auth/login" className="block w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white font-mono font-semibold hover:shadow-xl transition-all">&gt; login()</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutReturn() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-mono text-gray-500">// loading…</div>}>
      <ReturnInner />
    </Suspense>
  );
}
