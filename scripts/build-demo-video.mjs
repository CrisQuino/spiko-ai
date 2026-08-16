// Builds a POLISHED ≤45s narrated ad from the real app: warm Studio voices
// (narrator + two distinct dialogue voices), small elegant captions, a synced
// "recording"/"speaking" badge over the practice turns, subtle zoom, and a fast
// login. Output: public/demo/demo-narrated.mp4
//
//   npm run dev
//   node scripts/build-demo-video.mjs
import { chromium } from 'playwright';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import path from 'node:path';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim(); if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const BASE = 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL || 'spiko-e2e@example.com';
const PASSWORD = process.env.E2E_PASSWORD || 'Test-e2e-Passw0rd!';
const W = 1280, H = 720, FPS = 30, MAX_SECONDS = 50;
const ASSETS = path.resolve('scratch-demo');
const FONT = 'font.ttf';

// Which language demo to build:  node scripts/build-demo-video.mjs [en|fr|pt]
const LANG = (process.argv[2] || process.env.DEMO_LANG || 'en').toLowerCase();
const OUT = path.resolve(`public/demo/demo-${LANG}.mp4`);
const POSTER = path.resolve(`public/demo/demo-${LANG}-poster.jpg`);

// Narrator = warm Latin-American Spanish (natural Studio). Sarah (the AI
// colleague) = a woman's English voice. You = a Latin voice speaking English
// (Spanish accent) at a measured B2 pace, so the fluency matches the chosen
// level and feels realistic.
const ELEVEN_KEY = env.ELEVENLABS_API_KEY;

// Per-language demo config. Each language gets a DISTINCT scenario (role +
// language) and a DISTINCT CEFR level, and uses the OWNER's own cloned voice
// (recorded per language in ElevenLabs) for the learner turns. The AI colleague
// speaks the scenario language with a natural Google voice (a different person).
// Narration is always the same Latin-American Spanish voice-over.
const LANGS = {
  en: {
    label: 'English', modal: /English/, level: 'B2', role: 'Backend Engineer', industry: 'TECH',
    voiceId: env.DEMO_VOICE_ID_EN || 'NypX9UBqm1VQg8EJz4Q2',
    ai: { languageCode: 'en-US', name: 'en-US-Studio-O', rate: 1.0, pitch: 0 }, // female English (Studio)
    turns: [
      "What's failing, and which service is affected?",
      "Let me trace the logs — I'll add an index and a regression test.",
    ],
  },
  fr: {
    label: 'Français', modal: /Fran[cç]ais|French/, level: 'A2', role: 'Backend Engineer', industry: 'TECH',
    voiceId: env.DEMO_VOICE_ID_FR || 'Xyk1BdokdMYgjKUWcBeC',
    ai: { languageCode: 'fr-FR', name: 'fr-FR-Studio-A', rate: 1.0, pitch: 0 }, // female French (Studio)
    turns: [ // simple A2 phrasing
      "Quel service ne marche pas ? C’est grave ?",
      "D’accord. Je regarde les logs et je corrige le problème.",
    ],
  },
  pt: {
    label: 'Português', modal: /Portugu[eê]s|Portuguese/, level: 'B1', role: 'Senior Analyst, Finance Business Partner', industry: 'FINANCE',
    voiceId: env.DEMO_VOICE_ID_PT || '65eDZ1TeXBiKsM7pqBBi',
    ai: { languageCode: 'pt-BR', name: 'pt-BR-Neural2-C', rate: 1.0, pitch: 0 }, // female Portuguese (Neural2 — no Studio tier)
    turns: [ // finance business-partner scenario, simple B1 phrasing
      "Qual é a diferença no orçamento deste mês?",
      "Certo. Vou revisar os números e preparar a previsão.",
    ],
  },
};
const L = LANGS[LANG];
if (!L) throw new Error(`Unknown lang '${LANG}' (use en|fr|pt)`);
if (!L.voiceId) throw new Error(`No cloned voice id for ${LANG}; set DEMO_VOICE_ID_${LANG.toUpperCase()} in .env.local`);

const VOICES = {
  narrator: { languageCode: 'es-US', name: 'es-US-Studio-B', rate: 1.0, pitch: 0 },  // Latin Spanish voice-over (Google Studio)
  ai:       L.ai,                                                                     // AI colleague, speaks the scenario language
  user:     { provider: 'eleven', voiceId: L.voiceId },                              // the owner's cloned voice for this language
};
// The brand is spoken /spiːk eɪˈaɪ/ ("speak A-I"), never spelled out. Studio
// voices ignore SSML <phoneme>, so we spell it phonetically for the Latin
// Spanish narrator: "spik ei ái" → /spik eɪ ˈaɪ/.
const BRAND = 'spik ei ái';

// Keep it TIGHT — two short exchanges only. Learner turns in the scenario language.
const USER_TURNS = L.turns;
// First sentence only, so the AI line stays short on screen and in audio.
const firstSentence = (s) => {
  const m = String(s).replace(/\s+/g, ' ').trim().match(/^.*?[.!?](\s|$)/);
  let t = (m ? m[0] : String(s)).trim();
  if (t.length > 105) t = t.slice(0, 102).replace(/\s+\S*$/, '') + '…';
  return t;
};

const tts = new TextToSpeechClient({
  credentials: { client_email: env.GOOGLE_CLOUD_CLIENT_EMAIL, private_key: (env.GOOGLE_CLOUD_PRIVATE_KEY || '').replace(/\\n/g, '\n') },
  projectId: env.GOOGLE_CLOUD_PROJECT_ID,
});
const ffCwd = (args) => spawnSync(ffmpegPath, args, { cwd: ASSETS, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
function durationOf(file) {
  const r = spawnSync(ffmpegPath, ['-i', file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const m = (r.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
}
async function synth(text, v, outFile) {
  // The owner's cloned voice (ElevenLabs) for the user; Google TTS otherwise.
  if (v.provider === 'eleven') {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true } }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    return;
  }
  const isSsml = /<[a-z]/i.test(text);
  const input = isSsml ? { ssml: `<speak>${text}</speak>` } : { text };
  const [res] = await tts.synthesizeSpeech({
    input, voice: { languageCode: v.languageCode, name: v.name },
    audioConfig: { audioEncoding: 'MP3', speakingRate: v.rate, pitch: v.pitch || 0 },
  });
  fs.writeFileSync(outFile, Buffer.from(res.audioContent));
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019");
const wrap = (s, n = 74) => {
  const words = s.split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines.join('\n');
};

// Resolve the most recent completed session (with a CEFR result) for the demo
// user, via the service role — so we can open its real review page.
async function recentSessionId() {
  try {
    const REF = env.SUPABASE_PROJECT_REF, SBP = env.SUPABASE_ACCESS_TOKEN;
    const sql = (where) => `select lc.lesson_id from lesson_costs lc join profiles p on p.id=lc.user_id where p.email='${EMAIL}' and lc.scenario_type <> 'mock_seed' and lc.pronunciation_level is not null and lc.transcript is not null ${where} order by lc.completed_at desc limit 1`;
    // A real, fully-graded session (per-skill metrics + transcript). Prefer one in
    // THIS video's language first, then any strong session, then anything graded.
    for (const where of [`and lc.language='${LANG}'`, "and lc.cefr_overall in ('B2','C1','C2')", '']) {
      const rows = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql(where) }) })).json();
      if (Array.isArray(rows) && rows[0]?.lesson_id) return rows[0].lesson_id;
    }
    return null;
  } catch { return null; }
}

async function capture() {
  console.log('▶ Capturing app screens…');
  fs.mkdirSync(ASSETS, { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const bubbles = () => page.locator('p.text-sm.leading-relaxed');
  const input = () => page.getByPlaceholder(/response|réponse|resposta/i);
  const shot = (name) => page.screenshot({ path: path.join(ASSETS, `${name}.png`) });

  await page.goto(`${BASE}/`); await page.waitForTimeout(1200); await shot('landing');
  await page.goto(`${BASE}/auth/login`); await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(/.*dashboard/, { timeout: 30_000 }); await page.waitForTimeout(900);

  await page.getByRole('button', { name: /start_practice|start_first_practice/i }).first().click();
  const modal = page.locator('.max-w-lg'); await modal.waitFor({ state: 'visible', timeout: 10_000 });
  await modal.getByRole('button', { name: L.modal }).click();
  await modal.getByRole('button', { name: L.level, exact: true }).click();
  await modal.locator('select').selectOption({ label: L.role }).catch(async () => {
    const opts = await modal.locator('select option').all(); if (opts.length > 1) await modal.locator('select').selectOption({ index: 1 });
  });
  await page.waitForTimeout(600); await shot('setup');
  await modal.getByRole('button', { name: /start_practice/i }).click();
  await page.waitForURL(/.*demo\?/, { timeout: 15_000 });
  await page.getByRole('button', { name: /scenario\.start/i }).click({ timeout: 15_000 });
  await input().waitFor({ state: 'visible', timeout: 20_000 });
  await bubbles().first().waitFor({ timeout: 45_000 }); await page.waitForTimeout(1200);
  const aiOpener = (await bubbles().first().innerText()).trim();
  await shot('conv0');

  const aiReplies = [];
  for (let i = 0; i < USER_TURNS.length; i++) {
    // Send the message FIRST so the user's bubble is actually visible on screen.
    const before = await bubbles().count();
    const box = page.locator('input').first();
    await box.fill(USER_TURNS[i]); await box.press('Enter');
    await page.waitForFunction((n) => document.querySelectorAll('p.text-sm.leading-relaxed').length > n, before, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);
    // Now overlay a live-voice mockup on the bottom bar (the button becomes a
    // pulsing "● Recording…") so the recording UI coincides with the user's voice.
    await page.evaluate(() => {
      const voice = [...document.querySelectorAll('button')].find((b) => /voice/i.test(b.textContent || ''));
      if (voice) { voice.style.background = '#dc2626'; voice.style.boxShadow = '0 0 0 6px rgba(220,38,38,0.25)'; voice.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;color:#fff;font-weight:700"><span style="width:11px;height:11px;border-radius:50%;background:#fff;display:inline-block"></span>Recording…</span>'; }
    });
    await page.waitForTimeout(250); await shot(`user${i}`);
    // Wait for Sarah's reply.
    const start = Date.now();
    while ((await bubbles().count()) <= before + 1 && Date.now() - start < 45_000) await page.waitForTimeout(500);
    await page.waitForTimeout(700);
    aiReplies.push((await bubbles().last().innerText()).trim());
    await shot(`ai${i}`);
  }

  // CEFR assessment screen: the in-scenario modal only appears after a full
  // 5-minute session, so we open a REAL completed session's review page (with
  // its genuine CEFR breakdown) — resolved straight from the DB.
  try {
    const lessonId = await recentSessionId();
    if (lessonId) {
      await page.goto(`${BASE}/dashboard/session/${lessonId}`);
      await page.getByText(/cefr|level|assessment|nivel/i).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(1600);
    } else {
      await page.goto(`${BASE}/dashboard`); await page.waitForTimeout(1500);
    }
  } catch { await page.goto(`${BASE}/dashboard`).catch(() => {}); await page.waitForTimeout(1200); }
  await shot('result');

  // Accumulated progress: the dashboard's CEFR target-vs-assessed chart.
  try {
    await page.goto(`${BASE}/dashboard`); await page.waitForTimeout(1600);
    await page.evaluate(() => { const h = [...document.querySelectorAll('h2,h3')].find((e) => /cefr_progress/.test(e.textContent || '')); if (h) h.scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(1300);
  } catch { /* screenshot whatever is shown */ }
  await shot('progress');

  await browser.close();
  return { aiOpener, aiReplies };
}

async function main() {
  if (!ffmpegPath) throw new Error('ffmpeg-static not found');
  const cap = await capture();

  // Tight storyboard (≤45s). Narration in Latin-American Spanish; dialogue in
  // English. badge: null | 'rec' | 'speak'
  const S = [
    { shot: 'landing', voice: 'narrator', say: '¿Quieres mejorar tus interacciones en una segunda lengua, pero sin el escenario genérico del restaurante o el aeropuerto?', cap: '' },
    { shot: 'landing', voice: 'narrator', say: `¿Necesitas practicar específicamente para tu labor diaria? Con ${BRAND}.`, cap: '' },
    { shot: 'setup', voice: 'narrator', say: 'Eliges tu idioma, tu nivel, y el puesto para el que te preparas.', cap: '' },
    { shot: 'conv0', voice: 'narrator', say: 'La inteligencia artificial se convierte en tu colega, en un incidente real, y te habla.', cap: '' },
    { shot: 'conv0', voice: 'ai', say: firstSentence(cap.aiOpener), cap: firstSentence(cap.aiOpener), badge: 'speak' },
    { shot: 'user0', voice: 'user', say: USER_TURNS[0], cap: USER_TURNS[0], badge: 'rec' },
    { shot: 'ai0', voice: 'ai', say: firstSentence(cap.aiReplies[0] || 'Let me check that.'), cap: firstSentence(cap.aiReplies[0] || 'Let me check that.'), badge: 'speak' },
    { shot: 'user1', voice: 'user', say: USER_TURNS[1], cap: USER_TURNS[1], badge: 'rec' },
    { shot: 'result', voice: 'narrator', say: 'Al terminar, recibes tu evaluación al instante.', cap: '' },
    { shot: 'progress', voice: 'narrator', say: 'Y documentas tu progreso, sesión tras sesión.', cap: '' },
    { shot: 'landing', voice: 'narrator', say: `¿Qué esperas? ${BRAND} es tu mejor aliado para conseguir esa promoción que buscas.`, cap: '' },
  ];

  // Monospace to match the app's font-mono / code aesthetic.
  const sysFont = ['C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf'].find((f) => fs.existsSync(f));
  fs.copyFileSync(sysFont, path.join(ASSETS, FONT));
  const sysFontBold = ['C:/Windows/Fonts/consolab.ttf', 'C:/Windows/Fonts/seguisb.ttf', sysFont].find((f) => fs.existsSync(f));
  fs.copyFileSync(sysFontBold, path.join(ASSETS, 'fontb.ttf'));

  console.log('▶ Generating Studio voices + clips…');
  // 1) synth all, measure durations, decide a global speed factor to fit ≤45s.
  const durs = [];
  for (let i = 0; i < S.length; i++) { await synth(S[i].say, VOICES[S[i].voice], path.join(ASSETS, `a${i}.mp3`)); durs.push(durationOf(path.join(ASSETS, `a${i}.mp3`)) + 0.35); }
  const total = durs.reduce((a, b) => a + b, 0);
  const speed = total > MAX_SECONDS ? total / MAX_SECONDS : 1;           // >1 → speed up
  console.log(`  raw ${total.toFixed(1)}s → target ≤${MAX_SECONDS}s (speed ${speed.toFixed(2)}×)`);

  const segList = [];
  for (let i = 0; i < S.length; i++) {
    const seg = S[i];
    const dur = durs[i] / speed;
    const frames = Math.max(1, Math.round(dur * FPS));
    // No caption panel — just the real app with a subtle zoom; the narration
    // carries the story (the app's own indicators + the recording mockup show
    // who's speaking).
    const vf = `[0:v]scale=${W}:${H},setsar=1,zoompan=z='min(zoom+0.00035,1.05)':d=${frames}:s=${W}x${H}:fps=${FPS}[v]`;
    // Audio: optionally speed up to fit.
    const aChain = speed > 1.001 ? `[1:a]atempo=${Math.min(2, speed).toFixed(3)}[a]` : `[1:a]anull[a]`;
    const rr = ffCwd([
      '-y', '-loop', '1', '-i', `${seg.shot}.png`, '-i', `a${i}.mp3`,
      '-filter_complex', `${vf};${aChain}`, '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(2),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', `seg${i}.mp4`,
    ]);
    if (rr.status !== 0) { console.error('ffmpeg seg', i, 'failed:\n', (rr.stderr || '').split('\n').slice(-6).join('\n')); throw new Error('seg fail'); }
    segList.push(i);
    process.stdout.write(`  seg ${i + 1}/${S.length} (${seg.voice}, ${dur.toFixed(1)}s)  \r`);
  }

  console.log('\n▶ Concatenating…');
  // Use the concat FILTER (not the demuxer): it re-times every stream from zero,
  // so mp3/AAC priming offsets can't accumulate into freeze-frame gaps. The
  // demuxer concat was inflating the total by ~19s from those discontinuities.
  const inputs = segList.flatMap((i) => ['-i', `seg${i}.mp4`]);
  const streams = segList.map((i) => `[${i}:v][${i}:a]`).join('');
  const catFilter = `${streams}concat=n=${segList.length}:v=1:a=1[v][a]`;
  const cat = ffCwd(['-y', ...inputs, '-filter_complex', catFilter, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'out.mp4']);
  if (cat.status !== 0) { console.error(cat.stderr.split('\n').slice(-8).join('\n')); throw new Error('concat fail'); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.copyFileSync(path.join(ASSETS, 'out.mp4'), OUT);
  // Poster: a clean frame ~2s in (past the fade-in).
  ffCwd(['-y', '-ss', '2', '-i', 'out.mp4', '-frames:v', '1', '-q:v', '3', POSTER]);
  console.log(`✓ done [${LANG}] → ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${durationOf(OUT).toFixed(0)}s)  + poster`);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
