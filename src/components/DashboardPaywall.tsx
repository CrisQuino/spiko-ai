'use client';

/**
 * Full-screen gate shown to FREE (not-purchased) individual users in place of the
 * dashboard. Free users can run a scenario + see one CEFR result, but the
 * analytics dashboard (history, progress over time) is a paid feature. This is a
 * professional invitation to join the SPEECK.AI family. The subscribe button is a
 * no-op for now (wired to Wompi checkout separately).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function DashboardPaywall({ firstName }: { firstName?: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubscribe = async () => {
    setBusy(true);
    setNote('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.status === 503) {
        setNote('// checkout_coming_soon — ¡pronto podrás suscribirte!');
      } else if (res.ok) {
        const { url } = await res.json();
        if (url) { window.location.href = url; return; } // → Wompi Web Checkout
        setNote('// no_checkout_url');
      } else {
        setNote('// checkout_error — inténtalo de nuevo en un momento');
      }
    } catch {
      setNote('// checkout_error — inténtalo de nuevo en un momento');
    } finally {
      setBusy(false);
    }
  };

  const perks = [
    { icon: '📈', text: 'Tu progreso CEFR sesión tras sesión' },
    { icon: '🗂️', text: 'Historial completo de tus conversaciones' },
    { icon: '📊', text: 'Analítica personal y métricas por habilidad' },
    { icon: '♾️', text: 'Práctica ilimitada, sin límites diarios' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/30 to-cyan-50/30 px-6 py-12">
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg glass rounded-3xl border border-gray-200/60 shadow-2xl p-8 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center text-white text-2xl font-mono font-bold shadow-lg">
          &lt;/&gt;
        </div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono gradient-text mb-2">
          {firstName ? `${firstName}, ` : ''}únete a la familia SPEECK.AI
        </h1>
        <p className="text-gray-600 font-mono text-sm mb-6">
          <span className="text-gray-400">// </span>tu dashboard de progreso es una función premium
        </p>

        <div className="text-left space-y-3 mb-8">
          {perks.map((p) => (
            <div key={p.text} className="flex items-center gap-3">
              <span className="text-xl">{p.icon}</span>
              <span className="font-mono text-sm text-gray-700">{p.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onSubscribe}
          disabled={busy}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white text-lg font-mono font-semibold hover:shadow-xl transition-all mb-3 disabled:opacity-60"
        >
          <span className="mr-2">★</span> {busy ? 'starting_checkout()…' : 'subscribe()'}
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/demo')}
            className="flex-1 py-3 rounded-xl glass border-2 border-gray-300 text-gray-700 font-mono font-semibold hover:border-cyan-500 transition-all"
          >
            &gt; keep_practicing()
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 rounded-xl glass border-2 border-gray-300 text-gray-700 font-mono font-semibold hover:border-emerald-500 transition-all"
          >
            &lt; home()
          </button>
        </div>

        {note && <p className="mt-4 font-mono text-xs text-emerald-600">{note}</p>}

        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
          className="mt-6 text-red-400 hover:text-red-500 font-mono text-xs"
        >
          logout()
        </button>
      </motion.div>
    </div>
  );
}
