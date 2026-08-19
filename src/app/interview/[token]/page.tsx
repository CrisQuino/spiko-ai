'use client';

/**
 * Candidate-facing interview landing (no login). Validates the tokenized invite,
 * shows what the interview is, and hands off to the practice engine in interview
 * mode (/demo?interview=<token>), which records the result back to the invite.
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Invite = {
  ok?: boolean; error?: string;
  company_name?: string | null; language?: string; level?: string | null;
  jd_title?: string | null; candidate_name?: string | null; status?: string;
};

const LANG = { en: 'English', fr: 'Français', pt: 'Português' } as Record<string, string>;

export default function InterviewLanding() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch(`/api/interview/${params.token}`).then((r) => r.json()).then(setInvite).catch(() => setInvite({ error: 'network' }));
  }, [params.token]);

  const start = async () => {
    setStarting(true);
    await fetch(`/api/interview/${params.token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }),
    }).catch(() => {});
    router.push(`/demo?interview=${params.token}`);
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/30 to-cyan-50/30 px-6 py-12">
      <div className="w-full max-w-lg glass rounded-3xl border border-gray-200/60 shadow-2xl p-8 text-center">{children}</div>
    </div>
  );

  if (!invite) return shell(<div className="w-14 h-14 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />);

  if (invite.error || !invite.ok) {
    const msg = invite.error === 'expired' ? 'Esta invitación ya expiró.' : 'Invitación no válida.';
    return shell(<>
      <div className="text-5xl mb-3">⌛</div>
      <h1 className="font-mono font-bold text-xl text-gray-800 mb-2">invitation_unavailable()</h1>
      <p className="font-mono text-sm text-gray-600">{msg} Contacta a quien te invitó.</p>
    </>);
  }

  if (invite.status === 'completed') {
    return shell(<>
      <div className="text-5xl mb-3">✅</div>
      <h1 className="font-mono font-bold text-2xl gradient-text mb-2">¡Entrevista completada!</h1>
      <p className="font-mono text-sm text-gray-600">Gracias. Tus resultados ya fueron enviados a quien te invitó.</p>
    </>);
  }

  return shell(<>
    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center text-white text-2xl font-mono font-bold shadow-lg">&lt;/&gt;</div>
    <h1 className="text-2xl md:text-3xl font-bold font-mono gradient-text mb-1">Language interview</h1>
    <p className="font-mono text-xs text-gray-500 mb-6"><span className="text-gray-400">// </span>{invite.company_name || 'SPEECK.AI'}</p>

    <div className="text-left space-y-2 mb-6 font-mono text-sm">
      {invite.jd_title && <div className="flex justify-between gap-3"><span className="text-gray-400">role</span><span className="text-gray-800 font-semibold text-right">{invite.jd_title}</span></div>}
      <div className="flex justify-between gap-3"><span className="text-gray-400">language</span><span className="text-gray-800 font-semibold">{LANG[invite.language || 'en'] || (invite.language || 'en')}</span></div>
      {invite.level && <div className="flex justify-between gap-3"><span className="text-gray-400">target level</span><span className="text-gray-800 font-semibold">{invite.level}</span></div>}
    </div>

    <div className="text-left text-xs font-mono text-gray-500 bg-white/60 border border-gray-200 rounded-xl p-4 mb-6 space-y-1">
      <p>· No necesitas cuenta. Solo habla.</p>
      <p>· Permite el <b>micrófono</b> cuando te lo pida.</p>
      <p>· Al terminar recibes tu evaluación CEFR al instante.</p>
    </div>

    <button onClick={start} disabled={starting} className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white text-lg font-mono font-semibold hover:shadow-xl transition-all disabled:opacity-60">
      {starting ? 'starting()…' : '▶ start_interview()'}
    </button>
  </>);
}
