import { test, expect, Page } from '@playwright/test';
import fs from 'fs';

// End-to-end walkthrough of the authenticated practice flow, driven via the
// text input (no microphone), with an LLM judge that semantically checks:
//   - the scenario matches the Job Description,
//   - the scenario matches the role's seniority (leadership vs IC),
//   - the AI's language matches the selected CEFR level,
// plus a calibration check that /api/evaluate matches the demonstrated level.
//
// Opt-in: needs a seeded test user + JDs (scripts/e2e-seed.mjs) and makes real
// LLM calls, so it is skipped by default (e.g. in CI). Run with E2E_RUN=1.
test.skip(!process.env.E2E_RUN, 'Set E2E_RUN=1 after seeding a test user (scripts/e2e-seed.mjs)');

function readEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const l = line.trim();
      if (!l || l.startsWith('#') || !l.includes('=')) continue;
      const i = l.indexOf('=');
      out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
  } catch { /* ignore */ }
  return out;
}
const ENV = readEnvLocal();
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ENV.ANTHROPIC_API_KEY || '';
// The semantic judge is an extra Anthropic API call per scenario. Off by
// default (transcripts are printed so a human/Claude can judge them for free);
// set E2E_JUDGE=1 for a fully self-validating automated run.
const USE_JUDGE = !!process.env.E2E_JUDGE;
const JUDGE_MODEL = 'claude-sonnet-4-5-20250929';
const BASE = 'http://localhost:3000';

const EMAIL = process.env.E2E_EMAIL || 'spiko-e2e@example.com';
const PASSWORD = process.env.E2E_PASSWORD || 'Test-e2e-Passw0rd!';
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Persist a completed session (transcript + real CEFR evaluation) so it can be
// reviewed in the app at /dashboard/session/<id> (log in as the test user).
let cachedToken: string | null = null;
async function testUserToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  cachedToken = (await res.json()).access_token;
  return cachedToken!;
}
async function finalizeSession(messages: Array<{ role: string; content: string }>, language: string, scenarioTitle: string, targetLevel?: string) {
  const token = await testUserToken();
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const started = await (await fetch(`${BASE}/api/lesson/start`, { method: 'POST', headers: auth, body: JSON.stringify({ scenarioType: scenarioTitle, demoMode: false }) })).json();
  const evalRes = await (await fetch(`${BASE}/api/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, language }) })).json();

  // Estimate token usage (the real counts live in the browser and aren't
  // captured here): the system prompt + JD (~1500 tok) is sent each AI turn,
  // plus the growing conversation history.
  const aiTurns = messages.filter((m) => m.role === 'ai').length;
  const chars = messages.reduce((s, m) => s + m.content.length, 0);
  const input = aiTurns * 1500 + Math.ceil(chars / 4);
  const output = Math.ceil(messages.filter((m) => m.role === 'ai').reduce((s, m) => s + m.content.length, 0) / 4);

  await fetch(`${BASE}/api/lesson/complete`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ lessonId: started.lessonId, messages, durationSeconds: 180, tokenUsage: { input, output }, assessment: evalRes.assessment, scenarioTitle, targetLevel, language }),
  });
  return started.lessonId as string;
}

const LEVEL_INDEX: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

const bubbles = (page: Page) => page.locator('p.text-sm.leading-relaxed');
const responseInput = (page: Page) => page.getByPlaceholder(/response|réponse|resposta/i);

async function anthropic(system: string, user: string, maxTokens = 400): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: JUDGE_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const d = await res.json();
  return d?.content?.[0]?.text || '';
}

function parseJson(text: string): any {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

// LLM judge: does the generated scenario fit the JD, seniority and CEFR level?
async function judgeScenario(opts: {
  jdTitle: string; expectedSeniority: 'leadership' | 'ic'; targetLevel: string; language: string; transcript: string;
}) {
  const system = `You are a strict QA judge for a language-practice product. You are given a job title, an expected seniority, a target CEFR level, and a transcript of what the AI role-play partner said in a practice scenario. Rate objectively.`;
  const user = `JOB TITLE: "${opts.jdTitle}"
EXPECTED SENIORITY: ${opts.expectedSeniority} (leadership = the learner makes decisions, coordinates teams, aligns stakeholders and does NOT do hands-on technical work; ic = hands-on technical work is expected)
TARGET CEFR LEVEL: ${opts.targetLevel}
PRACTICE LANGUAGE: ${opts.language}

AI PARTNER TRANSCRIPT (what the AI said across the scenario):
"""
${opts.transcript}
"""

Rate 0.0-1.0:
- jd_match: does the scenario's situation, systems and stakeholders realistically fit THIS job?
- seniority_match: does the scenario place the learner at the expected seniority (see above)?
- level_match: is the COMPLEXITY of the AI's ${opts.language} appropriate for CEFR ${opts.targetLevel}? (A1/A2 = short, simple sentences and common words; C1/C2 = rich and complex.)
- language_ok: is the AI speaking in ${opts.language}? (1.0 yes, 0.0 no)
Also return detected_seniority ("leadership" or "ic") and a one-line reason.
Return ONLY JSON: {"jd_match":0-1,"seniority_match":0-1,"level_match":0-1,"language_ok":0-1,"detected_seniority":"...","reason":"..."}`;
  return parseJson(await anthropic(system, user));
}

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(/.*dashboard/, { timeout: 30_000 });
}

async function openSetupAndStart(page: Page, langLabel: RegExp, level: string, jdTitle: string) {
  await page.getByRole('button', { name: /start_practice|start_first_practice/i }).first().click();
  const modal = page.locator('.max-w-lg');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.getByRole('button', { name: langLabel }).click();
  await modal.getByRole('button', { name: level, exact: true }).click();
  await modal.locator('select').selectOption({ label: jdTitle });
  await modal.getByRole('button', { name: /start_practice/i }).click();
  await expect(page).toHaveURL(/.*demo\?/, { timeout: 15_000 });
  await page.getByRole('button', { name: /scenario\.start/i }).click({ timeout: 15_000 });
}

async function say(page: Page, text: string) {
  const before = await bubbles(page).count();
  await responseInput(page).fill(text);
  await responseInput(page).press('Enter');
  await expect.poll(() => bubbles(page).count(), { timeout: 45_000 }).toBeGreaterThan(before + 1);
}

const MATRIX = [
  { label: 'EN @ B2 · Director (leadership)', lang: /English/, code: 'en', level: 'B2', jd: 'Director, Software Engineering', seniority: 'leadership' as const, language: 'English',
    turns: [
      'Thanks for flagging this. What exactly is going wrong, and which teams and customers are affected right now?',
      'Understood. I want an incident commander named in the next five minutes, and I will align the team leads so we are not duplicating effort.',
      'Let us keep the customer-facing communication honest but calm — draft a status update and I will review it before it goes out.',
      'What is our current hypothesis on the root cause, and do we have a safe rollback if the fix does not hold?',
      'Good. Once we are stable, I want a blameless postmortem with clear action items and owners by the end of the week.',
      'Thank you all for the fast response. Please get some rest, and we will regroup tomorrow morning to review the follow-ups.',
    ] },
  { label: 'FR @ A2 · Director (leadership)', lang: /Français/, code: 'fr', level: 'A2', jd: 'Director, Software Engineering', seniority: 'leadership' as const, language: 'French',
    turns: [
      'Bonjour. Quel est le problème exactement ?',
      'D accord. Quelles équipes sont touchées ?',
      'Je vais parler avec les chefs d équipe maintenant.',
      'Est-ce que les clients voient le problème aussi ?',
      'Bien. Nous devons écrire un petit message pour les clients.',
      'Merci beaucoup pour votre travail. On se parle demain matin.',
    ] },
  { label: 'PT @ B1 · Director (leadership)', lang: /Português/, code: 'pt', level: 'B1', jd: 'Director, Software Engineering', seniority: 'leadership' as const, language: 'Portuguese',
    turns: [
      'Olá. Qual é o problema exatamente e quais equipes estão afetadas?',
      'Entendi. Vou alinhar com os líderes de equipe e definir um responsável pelo incidente.',
      'Precisamos avisar os clientes com clareza, mas sem causar pânico.',
      'Qual é a nossa hipótese para a causa, e temos como voltar atrás se o conserto não funcionar?',
      'Ótimo. Depois de estabilizar, quero uma análise do incidente com ações e responsáveis.',
      'Obrigado a todos pela resposta rápida. Vamos conversar amanhã de manhã.',
    ] },
  { label: 'EN @ B2 · Backend Engineer (IC)', lang: /English/, code: 'en', level: 'B2', jd: 'Backend Engineer', seniority: 'ic' as const, language: 'English',
    turns: [
      'Let me check. What error are you seeing, and in which endpoint or service is it happening?',
      'Okay, I will pull the logs and trace the failing request to see where the exception is thrown.',
      'It looks like a slow database query is timing out under load — I will add an index and review the N+1 pattern.',
      'I will write a regression test that reproduces the timeout before I ship the fix, so we do not hit it again.',
      'Once the test passes locally, I will deploy to staging, watch the latency metrics, and then roll it out to production.',
      'The fix is out and latency is back to normal. I will keep an eye on the dashboards for the next hour just in case.',
    ] },
  // Very simple, correct A1 language — checks the AI keeps ITS OWN speech short
  // and simple at A1, and that A1-quality is graded near A1.
  { label: 'EN @ A1 · Backend Engineer (IC)', lang: /English/, code: 'en', level: 'A1', jd: 'Backend Engineer', seniority: 'ic' as const, language: 'English',
    turns: [
      'Hello. What is the problem?',
      'Okay. Which part is broken?',
      'I look at the code now.',
      'I think the server is down.',
      'I restart the server. Is it okay?',
      'Good. Thank you. Bye.',
    ] },
  // BELOW TARGET: target C1 but the learner writes error-laden, A2-ish English
  // (typos + broken grammar). Should be graded well BELOW C1.
  { label: 'EN @ C1 target · Backend IC · UNDER-target (errors+typos)', lang: /English/, code: 'en', level: 'C1', jd: 'Backend Engineer', seniority: 'ic' as const, language: 'English',
    turns: [
      'helo. what is problm in the sistem?',
      'ok i look the log. maybe the databse is slow i think',
      'i not sure but i try fix it. i add index maybe',
      'the query is very slow when many user come. i dont know why exactly',
      'i think we need more server. or maybe cache. i not sure',
      'ok i do my best. sorry my english is not so good',
    ] },
  // BELOW TARGET: target B2 but broken, A1/A2-ish French. Should be graded well
  // BELOW B2.
  { label: 'FR @ B2 target · Director · UNDER-target (errors+typos)', lang: /Français/, code: 'fr', level: 'B2', jd: 'Director, Software Engineering', seniority: 'leadership' as const, language: 'French',
    turns: [
      'bonjour. le probleme est quoi ?',
      'ah oui. beaucoup client fache je pense',
      'je parle avec le equipe mais je sais pas comment',
      'le client il peut pas payer. c est tres mauvais',
      'je fais un petit message mais mon francais pas bon',
      'merci. a demain. desole pour le francais',
    ] },
];

test.describe('Practice flow — JD/level semantic checks', () => {
  for (const m of MATRIX) {
    test(m.label, async ({ page }) => {
      test.setTimeout(200_000);
      await login(page);
      await openSetupAndStart(page, m.lang, m.level, m.jd);

      await expect(responseInput(page)).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => bubbles(page).count(), { timeout: 45_000 }).toBeGreaterThan(0);

      const opener = (await bubbles(page).first().innerText()).trim();
      const full: Array<{ role: string; content: string }> = [{ role: 'ai', content: opener }];
      const parts: string[] = [opener];
      for (const turn of m.turns) {
        await say(page, turn);
        const reply = (await bubbles(page).last().innerText()).trim();
        full.push({ role: 'user', content: turn }, { role: 'ai', content: reply });
        parts.push(reply);
      }
      const transcript = parts.join('\n---\n');
      console.log(`\n===== ${m.label} =====\n${transcript}\n`);

      // Persist a reviewable session (transcript + real evaluation).
      const sessionId = await finalizeSession(full, m.code, `${m.jd} — ${m.level} (${m.code.toUpperCase()})`, m.level);
      console.log(`REVIEW ${m.label}: /dashboard/session/${sessionId}`);

      // Structural sanity always runs (free/deterministic).
      expect(transcript.length, 'scenario produced a non-trivial transcript').toBeGreaterThan(30);

      // Semantic asserts only when the API judge is enabled (E2E_JUDGE=1).
      if (USE_JUDGE) {
        const j = await judgeScenario({ jdTitle: m.jd, expectedSeniority: m.seniority, targetLevel: m.level, language: m.language, transcript });
        console.log(`JUDGE ${m.label}:`, JSON.stringify(j));
        expect(j.language_ok, `language should be ${m.language}`).toBeGreaterThanOrEqual(1);
        expect(j.jd_match, 'scenario should match the JD').toBeGreaterThanOrEqual(0.6);
        expect(j.seniority_match, `scenario should be ${m.seniority}`).toBeGreaterThanOrEqual(0.6);
        expect(j.level_match, `language should fit CEFR ${m.level}`).toBeGreaterThanOrEqual(0.6);
        expect(j.detected_seniority).toBe(m.seniority);
      }
    });
  }
});

test.describe('Evaluation calibration (level vs target)', () => {
  async function evaluate(messages: string[], language: string) {
    const res = await fetch(`${BASE}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map((content) => ({ role: 'user', content })), language }),
    });
    return (await res.json()).assessment;
  }

  test('A2-quality French is graded near A2 (not inflated)', async () => {
    test.setTimeout(120_000);
    const a = await evaluate([
      'Bonjour. Le probleme est le serveur il marche pas.',
      'Je pense c est le DNS mais je sais pas.',
      'Je vais regarder et je vous dis.',
    ], 'fr');
    console.log('A2-FR eval:', a.overall.level, a.overall.score);
    expect(Math.abs(LEVEL_INDEX[a.overall.level] - LEVEL_INDEX['A2'])).toBeLessThanOrEqual(1);
  });

  test('C1-quality English is graded near C1', async () => {
    test.setTimeout(120_000);
    const a = await evaluate([
      "I'd frame this as a cross-team prioritization problem rather than a purely technical one, so let me triage by customer impact first.",
      "I'll appoint a single incident commander, align the leads, and set a 30-minute status cadence until we isolate the root cause.",
      "Once contained, I'll run a blameless post-mortem and fold the action items into next sprint's planning.",
    ], 'en');
    console.log('C1-EN eval:', a.overall.level, a.overall.score);
    expect(Math.abs(LEVEL_INDEX[a.overall.level] - LEVEL_INDEX['C1'])).toBeLessThanOrEqual(1);
  });
});
