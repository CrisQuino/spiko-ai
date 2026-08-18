/**
 * DB ↔ APP consistency harness.
 *
 * Compares the SOURCE OF TRUTH (Postgres, via the Supabase Management API) against
 * what the DEPLOYED app actually returns through its API endpoints — as the real
 * roles (super-admin, manager) with real auth tokens. Catches "the DB says X but
 * the app shows Y" drift (e.g. a premium user missing from the super-admin list,
 * a margin not applied, RLS hiding rows).
 *
 * Run: node scripts/e2e-consistency.mjs   (reads .env.local)
 */
import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim(); if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF = env.SUPABASE_PROJECT_REF, MGMT = env.SUPABASE_ACCESS_TOKEN;
const SITE = process.env.SITE || 'https://spiko-mvp.vercel.app';

const channelOf = (p) => (p.company_id ? 'b2b' : p.plan === 'premium' ? 'b2c' : 'free');
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MGMT}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  return r.json();
};

// Mint a real user access token via admin magiclink → verify.
async function mintToken(email) {
  const gl = await (await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })).json();
  const hashed = gl?.hashed_token || gl?.properties?.hashed_token;
  if (!hashed) return null;
  const ver = await (await fetch(`${SUPA_URL}/auth/v1/verify`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  })).json();
  return ver?.access_token || null;
}
const callApi = async (path, token, payload) => {
  const r = await fetch(`${SITE}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
// Read a view/table as a given user (RLS applies) via PostgREST.
const restSelect = async (token, table, params) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : [];
};

async function main() {
  console.log(`\n▶ DB ↔ APP consistency @ ${SITE}\n`);
  const SUPER = 'dash.crs@gmail.com';
  const superToken = await mintToken(SUPER);
  if (!superToken) { check('mint super-admin token', false, 'generate_link failed'); return finish(); }
  check('mint super-admin token', true, SUPER);

  // ── 1) account_access: every DB profile appears in the app, with matching plan/company/channel.
  const dbProfiles = await sql(`select id, email, coalesce(plan,'free') plan, company_id from profiles;`);
  const api = await callApi('/api/admin', superToken, { action: 'list_users', search: '' });
  if (api.status !== 200) { check('list_users reachable', false, `status ${api.status}`); }
  else {
    const apiUsers = api.body.users || [];
    const apiById = new Map(apiUsers.map((u) => [u.id, u]));
    const missing = dbProfiles.filter((p) => !apiById.has(p.id));
    check('every DB profile is in account_access', missing.length === 0, missing.length ? `missing: ${missing.map((m) => m.email).join(', ')}` : `${dbProfiles.length} profiles`);
    const mismatches = [];
    for (const p of dbProfiles) {
      const u = apiById.get(p.id); if (!u) continue;
      if (u.plan !== p.plan) mismatches.push(`${p.email}: plan db=${p.plan} app=${u.plan}`);
      if ((u.company_id || null) !== (p.company_id || null)) mismatches.push(`${p.email}: company mismatch`);
      if (channelOf(u) !== channelOf(p)) mismatches.push(`${p.email}: channel db=${channelOf(p)} app=${channelOf(u)}`);
    }
    check('plan/company/channel match app↔db for all users', mismatches.length === 0, mismatches.slice(0, 6).join(' | '));

    // ── 2) channel counts match.
    const dbC = { free: 0, b2c: 0, b2b: 0 }; dbProfiles.forEach((p) => dbC[channelOf(p)]++);
    const apiC = { free: 0, b2c: 0, b2b: 0 }; apiUsers.forEach((u) => apiC[channelOf(u)]++);
    check('channel counts match', JSON.stringify(dbC) === JSON.stringify(apiC), `db=${JSON.stringify(dbC)} app=${JSON.stringify(apiC)}`);
  }

  // ── 3) Super-admin analytics view (RLS) sees ALL lessons (matches service-role count).
  const svc = await sql(`select count(*)::int n from admin_lessons_detail;`);
  const svcCount = svc?.[0]?.n ?? -1;
  const rls = await restSelect(superToken, 'admin_lessons_detail', 'select=lesson_id&limit=10000');
  check('super-admin sees all lessons (RLS == service count)', rls.length === svcCount, `service=${svcCount} rls=${rls.length}`);

  // ── 4) Team margin applied: team price == db cost × (1+margin).
  const marginRow = await sql(`select margin_pct from platform_settings where id=1;`);
  const margin = Number(marginRow?.[0]?.margin_pct || 0);
  const mgrRow = await sql(`select p.email from profiles p where p.role='manager' and p.company_id is not null order by p.email limit 1;`);
  const mgrEmail = mgrRow?.[0]?.email;
  if (!mgrEmail) { check('team margin check', false, 'no manager found'); }
  else {
    const mgrToken = await mintToken(mgrEmail);
    const t = mgrToken ? await callApi('/api/team', mgrToken, { action: 'analytics' }) : { status: 0, body: {} };
    if (t.status !== 200) { check('team analytics reachable', false, `status ${t.status} (${mgrEmail})`); }
    else {
      const priceView = t.body.priceView === true;
      const apiSum = (t.body.lessons || []).reduce((s, l) => s + Number(l.total_cost || 0), 0);
      // DB cost for that manager's company members.
      const comp = await sql(`select company_id from profiles where email='${mgrEmail}';`);
      const cid = comp?.[0]?.company_id;
      const dbSumRow = await sql(`select coalesce(sum(total_cost),0) c from admin_lessons_detail where company_id='${cid}';`);
      const dbSum = Number(dbSumRow?.[0]?.c || 0);
      const expected = dbSum * (1 + margin / 100);
      const ok = Math.abs(apiSum - expected) < Math.max(0.01, expected * 0.001);
      check('team dashboard shows PRICE (priceView)', priceView, `mgr=${mgrEmail}`);
      check(`team price == db cost × (1+${margin}%)`, ok, `app=${apiSum.toFixed(4)} expected=${expected.toFixed(4)} (raw db=${dbSum.toFixed(4)})`);
    }
  }

  // ── 5) Payments ↔ plan integrity: any APPROVED payment ⇒ that user is premium.
  const badPay = await sql(`
    select pm.email from payments pm join profiles pr on pr.id=pm.user_id
    where pm.status='APPROVED' and pr.plan <> 'premium' and pr.company_id is null;`);
  check('every APPROVED payer is premium', (badPay?.length || 0) === 0, badPay?.length ? badPay.map((b) => b.email).join(', ') : 'ok');

  finish();
}
function finish() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n──────── ${results.length - failed.length}/${results.length} checks passed ────────`);
  if (failed.length) { console.log('FAILURES:'); failed.forEach((f) => console.log(`  ✗ ${f.name}: ${f.detail}`)); process.exitCode = 1; }
  else console.log('ALL CONSISTENT — no DB↔app drift.');
}
main().catch((e) => { console.error('ERR', e); process.exitCode = 1; });
