// Comprehensive E2E for Phase 1 gates. Uses the service role to set up users /
// companies / limits, then exercises each gate with real user tokens against
// the running app, asserting the expected block. Run against a local dev
// server (BASE). Prints PASS/FAIL per case and exits non-zero on any failure.
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
const PW = 'Phase1-test-Passw0rd!';

let service;
const admin = (p, o = {}) => fetch(`${SUPABASE_URL}${p}`, { ...o, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(o.headers || {}) } });

async function ensureUser(email) {
  const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password: PW, email_confirm: true }) })).json();
  if (created.id) return created.id;
  const list = await (await admin('/auth/v1/admin/users?per_page=1000')).json();
  return (list.users || []).find((u) => u.email === email)?.id;
}
async function setProfile(id, email, patch) {
  await admin('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, email, full_name: email.split('@')[0], role: 'employee', company_id: null, plan: 'free', status: 'active', ...patch }) });
}
async function token(email) {
  return (await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json()).access_token;
}
const zeroSessions = (id) => admin(`/rest/v1/lesson_costs?user_id=eq.${id}`, { method: 'DELETE' });
const zeroJds = (id) => admin(`/rest/v1/job_descriptions?user_id=eq.${id}`, { method: 'DELETE' });
async function makeCompany(name, patch) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await admin(`/rest/v1/companies?slug=eq.${slug}`, { method: 'DELETE' });
  const row = await (await admin('/rest/v1/companies', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, slug, plan: 'corporate', max_users: 50, status: 'active', ...patch }) })).json();
  return Array.isArray(row) ? row[0].id : row.id;
}
async function start(tok) {
  const r = await fetch(`${BASE}/api/lesson/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ scenarioType: 'p1-test', demoMode: false }) });
  return { status: r.status, code: (await r.json().catch(() => ({}))).code };
}
async function insertJd(tok, userId, companyId, visibility) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/job_descriptions`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ user_id: userId, title: 'T', content: 'C', company_id: companyId ?? null, visibility: visibility ?? 'personal' }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function listJds(tok) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/job_descriptions?select=id,user_id,visibility`, { headers: { apikey: ANON, Authorization: `Bearer ${tok}` } });
  return await r.json();
}

const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${SBP}` } })).json();
  service = keys.find((k) => k.name === 'service_role').api_key;
  const freeLimit = (await (await admin('/rest/v1/platform_settings?select=free_monthly_sessions,free_max_jds&id=eq.1')).json())[0];
  const N = freeLimit.free_monthly_sessions, JDN = freeLimit.free_max_jds;

  // A) Free monthly session limit
  {
    const email = 'p1-free@spiko-test.example';
    const id = await ensureUser(email); await setProfile(id, email, { company_id: null, plan: 'free' }); await zeroSessions(id);
    const tk = await token(email);
    const seq = [];
    for (let i = 0; i < N + 1; i++) seq.push(await start(tk));
    check(`A free session limit (${N}/mo)`, seq.slice(0, N).every((r) => r.status === 200) && seq[N].status === 403 && seq[N].code === 'free_limit', JSON.stringify(seq.map((r) => r.status + (r.code ? ':' + r.code : ''))));
  }

  // B) Revoked user blocked
  {
    const email = 'p1-revoked@spiko-test.example';
    const id = await ensureUser(email); await setProfile(id, email, { status: 'revoked' }); await zeroSessions(id);
    const r = await start(await token(email));
    check('B revoked user blocked', r.status === 403 && r.code === 'revoked', `${r.status}:${r.code}`);
  }

  // C) Suspended company blocked
  {
    const cid = await makeCompany('P1 Suspended Co', { status: 'suspended' });
    const email = 'p1-susp@spiko-test.example';
    const id = await ensureUser(email); await setProfile(id, email, { company_id: cid, plan: 'corporate', status: 'active' }); await zeroSessions(id);
    const r = await start(await token(email));
    check('C suspended company blocked', r.status === 403 && r.code === 'company_suspended', `${r.status}:${r.code}`);
  }

  // D) Corporate daily limit
  {
    const cid = await makeCompany('P1 Daily Co', { status: 'active', daily_practice_limit: 2, monthly_practice_limit: null });
    const email = 'p1-daily@spiko-test.example';
    const id = await ensureUser(email); await setProfile(id, email, { company_id: cid, plan: 'corporate', status: 'active' }); await zeroSessions(id);
    const tk = await token(email);
    const seq = [await start(tk), await start(tk), await start(tk)];
    check('D corporate daily limit (2/day)', seq[0].status === 200 && seq[1].status === 200 && seq[2].status === 403 && seq[2].code === 'daily_limit', JSON.stringify(seq.map((r) => r.status + (r.code ? ':' + r.code : ''))));
  }

  // E) Corporate monthly limit
  {
    const cid = await makeCompany('P1 Monthly Co', { status: 'active', daily_practice_limit: null, monthly_practice_limit: 2 });
    const email = 'p1-monthly@spiko-test.example';
    const id = await ensureUser(email); await setProfile(id, email, { company_id: cid, plan: 'corporate', status: 'active' }); await zeroSessions(id);
    const tk = await token(email);
    const seq = [await start(tk), await start(tk), await start(tk)];
    check('E corporate monthly limit (2/mo)', seq[0].status === 200 && seq[1].status === 200 && seq[2].status === 403 && seq[2].code === 'monthly_limit', JSON.stringify(seq.map((r) => r.status + (r.code ? ':' + r.code : ''))));
  }

  // F) JD cap enforced by DB trigger (individual free)
  {
    const email = 'p1-jdcap@spiko-test.example';
    const id = await ensureUser(email); await setProfile(id, email, { company_id: null, plan: 'free' }); await zeroJds(id);
    const tk = await token(email);
    const seq = [];
    for (let i = 0; i < JDN + 1; i++) seq.push(await insertJd(tk, id, null, 'personal'));
    const okFirst = seq.slice(0, JDN).every((r) => r.status === 201 || r.status === 200);
    const blocked = seq[JDN].status >= 400 && JSON.stringify(seq[JDN].body).includes('JD_LIMIT');
    check(`F JD cap enforced by trigger (${JDN})`, okFirst && blocked, `statuses=${JSON.stringify(seq.map((r) => r.status))}`);
  }

  // G) JD visibility (company shared vs personal)
  {
    const cid = await makeCompany('P1 Visibility Co', { status: 'active', max_jds_per_user: null });
    const mgr = 'p1-mgr@spiko-test.example', mem = 'p1-mem@spiko-test.example', other = 'p1-other@spiko-test.example';
    const mid = await ensureUser(mgr), nid = await ensureUser(mem), oid = await ensureUser(other);
    await setProfile(mid, mgr, { company_id: cid, role: 'manager', plan: 'corporate' });
    await setProfile(nid, mem, { company_id: cid, plan: 'corporate' });
    await setProfile(oid, other, { company_id: cid, plan: 'corporate' });
    await zeroJds(mid); await zeroJds(nid); await zeroJds(oid);
    const mgrJd = await insertJd(await token(mgr), mid, cid, 'company');
    const memJd = await insertJd(await token(mem), nid, cid, 'personal');
    const companyJdId = Array.isArray(mgrJd.body) ? mgrJd.body[0].id : mgrJd.body.id;
    const personalJdId = Array.isArray(memJd.body) ? memJd.body[0].id : memJd.body.id;
    const otherSees = await listJds(await token(other));
    const seesCompany = otherSees.some((j) => j.id === companyJdId);
    const seesPersonal = otherSees.some((j) => j.id === personalJdId);
    check('G JD visibility (company shared, personal hidden)', seesCompany && !seesPersonal, `seesCompany=${seesCompany} seesPersonal=${seesPersonal}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? '❌ ' + failed.length + ' FAILED' : '✅ ALL ' + results.length + ' PASSED'}`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
