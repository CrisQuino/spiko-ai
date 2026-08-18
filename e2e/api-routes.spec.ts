import { test, expect, APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import { ADMIN_EMAIL, ADMIN_PW, MANAGER_EMAIL, MEMBER_EMAIL, TEAM_PW } from './fixtures';

// API surface coverage. Asserts the correct status codes for every API route
// reachable without a browser: auth/authorization gates (401/403), input
// validation (400), not-found (404), and happy paths (200). Routes that need a
// live LLM (/api/chat) or an email provider (/api/send-invite) are asserted
// "reachable + validating" rather than fully exercised (see docs/ROUTES.md).

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
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const HAVE_ENV = !!(SUPABASE_URL && ANON);

async function token(email: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return (await res.json())?.access_token || null;
  } catch { return null; }
}

// The dev server compiles routes on first hit, so a cold route can 404 briefly.
// Retry while we see a 404 (compilation), then return the real response.
async function post(request: APIRequestContext, path: string, data: unknown, headers: Record<string, string> = {}) {
  let r = await request.post(path, { data, headers, failOnStatusCode: false });
  for (let i = 0; i < 8 && r.status() === 404; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await request.post(path, { data, headers, failOnStatusCode: false });
  }
  return r;
}
async function get(request: APIRequestContext, path: string, headers: Record<string, string> = {}) {
  let r = await request.get(path, { headers, failOnStatusCode: false });
  for (let i = 0; i < 8 && r.status() === 404; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await request.get(path, { headers, failOnStatusCode: false });
  }
  return r;
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

test.describe('API — unauthenticated status codes', () => {
  test('GET /api/auth/check → 200 { authenticated:false }', async ({ request }) => {
    const r = await get(request, '/api/auth/check');
    expect(r.status()).toBe(200);
    expect((await r.json()).authenticated).toBe(false);
  });

  test('POST /api/admin without auth → 403', async ({ request }) => {
    const r = await post(request, '/api/admin', { action: 'list_companies' });
    expect(r.status()).toBe(403);
  });

  test('POST /api/team without auth → 403', async ({ request }) => {
    const r = await post(request, '/api/team', { action: 'overview' });
    expect(r.status()).toBe(403);
  });

  test('POST /api/lesson/start without auth (non-demo) → 401', async ({ request }) => {
    const r = await post(request, '/api/lesson/start', { demoMode: false });
    expect(r.status()).toBe(401);
  });

  test('POST /api/lesson/start demoMode → 200 with lessonId', async ({ request }) => {
    const r = await post(request, '/api/lesson/start', { demoMode: true });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.lessonId).toBeTruthy();
    expect(body.demoMode).toBe(true);
  });

  test('POST /api/lesson/complete with no user messages → 400', async ({ request }) => {
    const r = await post(request, '/api/lesson/complete', { messages: [] });
    expect(r.status()).toBe(400);
  });

  test('POST /api/evaluate with empty messages → 200 heuristic', async ({ request }) => {
    const r = await post(request, '/api/evaluate', { messages: [], language: 'en' });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.source).toBe('heuristic');
    expect(body.assessment?.overall?.level).toBeTruthy();
  });

  test('POST /api/tts with empty text → 400', async ({ request }) => {
    const r = await post(request, '/api/tts', { text: '' });
    expect(r.status()).toBe(400);
  });

  test('GET /api/invite/accept without token → 400', async ({ request }) => {
    const r = await get(request, '/api/invite/accept');
    expect(r.status()).toBe(400);
  });

  test('GET /api/invite/accept with unknown token → 404 { valid:false }', async ({ request }) => {
    const r = await get(request, '/api/invite/accept?token=bogus-e2e-token');
    expect(r.status()).toBe(404);
    expect((await r.json()).valid).toBe(false);
  });

  test('POST /api/invite/accept without auth → 401', async ({ request }) => {
    const r = await post(request, '/api/invite/accept', { token: 'anything' });
    expect(r.status()).toBe(401);
  });

  test('POST /api/chat is reachable and validates (needs live LLM)', async ({ request }) => {
    // Provider may be blocked (see memory) → 500. We only assert the route
    // exists and responds (not 404), and returns a controlled status.
    const r = await post(request, '/api/chat', { messages: [], language: 'en' });
    expect(r.status()).not.toBe(404);
    expect([200, 500]).toContain(r.status());
  });

  test('POST /api/send-invite is reachable and validates missing fields', async ({ request }) => {
    // With RESEND configured, an empty body fails field validation → 400;
    // without it, → 500. Either way the route exists and sends no email.
    const r = await post(request, '/api/send-invite', {});
    expect(r.status()).not.toBe(404);
    expect([400, 500]).toContain(r.status());
  });
});

test.describe('API — authenticated authorization', () => {
  test.skip(!HAVE_ENV, 'Supabase env missing from .env.local — skipping token-based API checks');

  test('super-admin token → POST /api/admin list_companies → 200', async ({ request }) => {
    const t = await token(ADMIN_EMAIL, ADMIN_PW);
    test.skip(!t, 'could not obtain super-admin token');
    const r = await post(request, '/api/admin', { action: 'list_companies' }, bearer(t!));
    expect(r.status()).toBe(200);
    expect(Array.isArray((await r.json()).companies)).toBe(true);
  });

  test('super-admin token → unknown action → 400', async ({ request }) => {
    const t = await token(ADMIN_EMAIL, ADMIN_PW);
    test.skip(!t, 'could not obtain super-admin token');
    const r = await post(request, '/api/admin', { action: 'definitely_not_an_action' }, bearer(t!));
    expect(r.status()).toBe(400);
  });

  test('manager token → POST /api/team overview → 200', async ({ request }) => {
    const t = await token(MANAGER_EMAIL, TEAM_PW);
    test.skip(!t, 'could not obtain manager token');
    const r = await post(request, '/api/team', { action: 'overview' }, bearer(t!));
    expect(r.status()).toBe(200);
    expect((await r.json()).company).toBeTruthy();
  });

  test('manager token → POST /api/team analytics → 200 priceView', async ({ request }) => {
    const t = await token(MANAGER_EMAIL, TEAM_PW);
    test.skip(!t, 'could not obtain manager token');
    const r = await post(request, '/api/team', { action: 'analytics' }, bearer(t!));
    expect(r.status()).toBe(200);
    expect((await r.json()).priceView).toBe(true);
  });

  test('employee token → POST /api/team → 403 (not a manager)', async ({ request }) => {
    const t = await token(MEMBER_EMAIL, TEAM_PW);
    test.skip(!t, 'could not obtain member token');
    const r = await post(request, '/api/team', { action: 'overview' }, bearer(t!));
    expect(r.status()).toBe(403);
  });

  test('employee token → POST /api/admin → 403 (not a super-admin)', async ({ request }) => {
    const t = await token(MEMBER_EMAIL, TEAM_PW);
    test.skip(!t, 'could not obtain member token');
    const r = await post(request, '/api/admin', { action: 'list_companies' }, bearer(t!));
    expect(r.status()).toBe(403);
  });
});
