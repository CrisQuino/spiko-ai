// E2E check for the Phase 1 free monthly session limit.
// Creates a fresh individual user (no company, plan=free), zeroes their
// sessions, then calls /api/lesson/start until it is blocked. Expects the
// first FREE_MONTHLY_SESSIONS to succeed and the next to return 403 free_limit.
import fs from 'fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim();
  if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('=');
  env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF = env.SUPABASE_PROJECT_REF;
const SBP = env.SUPABASE_ACCESS_TOKEN;
const BASE = 'http://localhost:3000';
const EMAIL = 'limit-test@spiko-demo.test';
const PASSWORD = 'Limit-test-Passw0rd!';

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${SBP}` } })).json();
  const service = keys.find((k) => k.name === 'service_role').api_key;
  const admin = (p, o = {}) => fetch(`${SUPABASE_URL}${p}`, { ...o, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(o.headers || {}) } });

  // The gate reads the limit from platform_settings (super-admin editable), so
  // the test asserts against that live value — not an env var.
  const LIMIT = (await (await admin('/rest/v1/platform_settings?select=free_monthly_sessions&id=eq.1')).json())[0].free_monthly_sessions;

  // create or find the user
  let userId;
  const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }) })).json();
  if (created.id) userId = created.id;
  else {
    const list = await (await admin('/auth/v1/admin/users?per_page=500')).json();
    userId = (list.users || []).find((u) => u.email === EMAIL)?.id;
  }
  if (!userId) throw new Error('no user: ' + JSON.stringify(created));

  // ensure individual profile (no company, free, active) and zero sessions
  await admin('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: userId, email: EMAIL, full_name: 'Limit Test', role: 'employee', company_id: null, plan: 'free', status: 'active' }) });
  await admin(`/rest/v1/lesson_costs?user_id=eq.${userId}`, { method: 'DELETE' });

  // login → token
  const tok = (await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })).json()).access_token;

  console.log(`Limit = ${LIMIT}. Firing ${LIMIT + 1} lesson/start calls...`);
  const results = [];
  for (let i = 1; i <= LIMIT + 1; i++) {
    const res = await fetch(`${BASE}/api/lesson/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ scenarioType: 'limit-test', demoMode: false }) });
    const body = await res.json().catch(() => ({}));
    results.push({ n: i, status: res.status, code: body.code, ok: res.ok });
    console.log(`  #${i}: HTTP ${res.status}${body.code ? ' code=' + body.code : ''}`);
  }

  const passed = results.filter((r) => r.n <= LIMIT).every((r) => r.status === 200) && results.find((r) => r.n === LIMIT + 1)?.status === 403 && results.find((r) => r.n === LIMIT + 1)?.code === 'free_limit';
  console.log(passed ? `\n✅ PASS — first ${LIMIT} allowed, #${LIMIT + 1} blocked with free_limit` : '\n❌ FAIL — gate did not behave as expected');
  process.exit(passed ? 0 : 1);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
