'use client';

/**
 * Enterprise "Contact Sales" form. Collects subject, company, (optional) email
 * and a message, and stores it for the super-admin inbox via /api/contact.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ContactSalesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setSubject(''); setCompany(''); setEmail(''); setMessage(''); setSent(false); setError(''); };
  const close = () => { onClose(); setTimeout(reset, 300); };

  const submit = async () => {
    if (!subject.trim() || !message.trim()) { setError('El asunto y el mensaje son obligatorios.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, company, email, message }),
      });
      if (res.ok) setSent(true);
      else setError('No se pudo enviar. Inténtalo de nuevo.');
    } catch { setError('No se pudo enviar. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={close}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className="w-full max-w-lg glass rounded-3xl border border-gray-200/60 shadow-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <h2 className="font-mono font-bold text-2xl gradient-text mb-2">¡Mensaje enviado!</h2>
                <p className="font-mono text-sm text-gray-600 mb-6">Nuestro equipo de ventas te contactará pronto.</p>
                <button onClick={close} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white font-mono font-semibold hover:shadow-xl transition-all">close()</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-mono font-bold text-2xl gradient-text">contact_sales()</h2>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600 font-mono">✕</button>
                </div>
                <p className="font-mono text-xs text-gray-500 mb-5"><span className="text-gray-400">// </span>cuéntanos qué necesita tu empresa</p>

                <label className="block mb-3">
                  <span className="font-mono text-xs text-gray-500">Asunto *</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Plan para 30 personas" className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
                </label>
                <label className="block mb-3">
                  <span className="font-mono text-xs text-gray-500">Empresa</span>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de tu empresa" className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
                </label>
                <label className="block mb-3">
                  <span className="font-mono text-xs text-gray-500">Email de contacto</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm" />
                </label>
                <label className="block mb-4">
                  <span className="font-mono text-xs text-gray-500">Mensaje *</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Cuéntanos sobre tu equipo y lo que buscas…" className="mt-1 w-full bg-white/70 border border-gray-200 rounded-md px-3 py-2 font-mono text-sm resize-none" />
                </label>

                {error && <p className="font-mono text-xs text-red-500 mb-3">{error}</p>}
                <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white font-mono font-semibold hover:shadow-xl transition-all disabled:opacity-60">
                  {busy ? 'sending()…' : 'send()'}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
