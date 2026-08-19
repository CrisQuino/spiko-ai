'use client';

import { useEffect, useState } from 'react';

/** Install affordance:
 *  - Chrome/Edge/Android: a one-tap "install" button (beforeinstallprompt).
 *  - iOS Safari (no such event): a dismissible hint to use Share → Add to Home Screen.
 */
export default function InstallPWA() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setInstalled(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari: no beforeinstallprompt — offer the manual hint once.
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIOS && !isStandalone && localStorage.getItem('ios-install-dismissed') !== '1') {
      const t = setTimeout(() => setIosHint(true), 2500);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
    }
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => { deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
        className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-mono font-semibold shadow-xl hover:shadow-2xl transition-all"
      >
        ⤓ install_app()
      </button>
    );
  }

  if (iosHint) {
    return (
      <div className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-sm glass border border-gray-200/70 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-mono font-bold">&lt;/&gt;</div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-semibold text-gray-800">Instala SPEECK.AI</p>
          <p className="font-mono text-xs text-gray-500 mt-0.5">Toca <b>Compartir</b> <span aria-hidden>􀈂</span>↑ y luego <b>“Añadir a pantalla de inicio”</b>.</p>
        </div>
        <button onClick={() => { localStorage.setItem('ios-install-dismissed', '1'); setIosHint(false); }} className="shrink-0 text-gray-400 hover:text-gray-600 font-mono text-sm">✕</button>
      </div>
    );
  }

  return null;
}
