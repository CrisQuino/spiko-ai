'use client';

/**
 * Where Wompi sends the buyer back after Web-Checkout (?id=<transactionId>).
 * We show a provisional result; the WEBHOOK is the source of truth for the plan,
 * so we poll the user's profile briefly to reflect the upgrade once it lands.
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function ReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const txId = params.get('id');
  const [state, setState] = useState<'checking' | 'premium' | 'pending'>('checking');

  useEffect(() => {
    let tries = 0;
    const tick = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
        if (data?.plan === 'premium') { setState('premium'); return; }
      }
      if (++tries >= 8) { setState('pending'); return; }
      setTimeout(tick, 2000);
    };
    tick();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/30 to-cyan-50/30 px-6">
      <div className="w-full max-w-md glass rounded-3xl border border-gray-200/60 shadow-2xl p-8 text-center">
        {state === 'checking' && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <h1 className="font-mono font-bold text-xl gradient-text mb-1">confirmando_pago()</h1>
            <p className="font-mono text-xs text-gray-500">Estamos confirmando tu transacción…</p>
          </>
        )}
        {state === 'premium' && (
          <>
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="font-mono font-bold text-2xl gradient-text mb-2">¡Bienvenido a premium!</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">Tu dashboard completo ya está desbloqueado.</p>
            <button onClick={() => router.push('/dashboard')} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white font-mono font-semibold hover:shadow-xl transition-all">&gt; go_to_dashboard()</button>
          </>
        )}
        {state === 'pending' && (
          <>
            <div className="text-5xl mb-3">⏳</div>
            <h1 className="font-mono font-bold text-xl text-gray-800 mb-2">pago_en_proceso()</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">Tu pago se está procesando. En cuanto se apruebe, tu cuenta se actualizará automáticamente.{txId ? ` (tx: ${txId.slice(0, 10)}…)` : ''}</p>
            <Link href="/dashboard" className="block w-full py-3 rounded-xl glass border-2 border-gray-300 text-gray-700 font-mono font-semibold hover:border-cyan-500 transition-all">&gt; back_to_dashboard()</Link>
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
