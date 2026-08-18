'use client';

import { useEffect, useState } from 'react';

/** Floating "install" button — shows only when the browser reports the app is
 * installable (Chrome/Edge/Android). iOS uses Share → Add to Home Screen. */
export default function InstallPWA() {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setHidden(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || hidden) return null;
  return (
    <button
      onClick={async () => { deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
      className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono text-sm font-semibold shadow-xl hover:shadow-2xl transition-all"
    >
      ⤓ install_app()
    </button>
  );
}
