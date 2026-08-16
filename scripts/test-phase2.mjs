// E2E for the Phase 2 super-admin API (/api/admin). Uses a test super-admin
// (allowed via SUPER_ADMIN_EMAILS locally) to exercise every action, checks a
// non-admin is rejected, and verifies DB effects with the service role.
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
const PW = 'Phase2-test-Passw0rd!';
const ADMIN_EMAIL = 'p2-admin@spiko-test.example';
const USER_EMAIL = 'p2-user@spiko-test.example';

let service;
const admin = (p, o = {}) => fetch(`${SUPABASE_URL}${p}`, { ...o, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(o.headers || {}) } });
async function ensureUser(email) {
  const c = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password: PW, email_confirm: true }) })).json();
  if (c.id) return c.id;
  const list = await (await admin('/auth/v1/admin/users?per_page=1000')).json();
  return (list.users || []).find((u) => u.email === email)?.id;
}
async function setProfile(id, email, patch) {
  await admin('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, email, full_name: email.split('@')[0], role: 'employee', company_id: null, plan: 'free', status: 'active', ...patch }) });
}
async function token(email) {
  return (await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json()).access_token;
}
async function api(action, params, tok) {
  const r = await fetch(`${BASE}/api/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action, ...params }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const dbRow = async (path) => await (await admin(path)).json();

const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${SBP}` } })).json();
  service = keys.find((k) => k.name === 'service_role').api_key;

  const adminId = await ensureUser(ADMIN_EMAIL); await setProfile(adminId, ADMIN_EMAIL, {});
  const userId = await ensureUser(USER_EMAIL); await setProfile(userId, USER_EMAIL, { company_id: null, plan: 'free', status: 'active' });
  const adminTok = await token(ADMIN_EMAIL);
  const userTok = await token(USER_EMAIL);

  // 1) non-admin rejected
  {
    const r = await api('list_companies', {}, userTok);
    check('1 non-admin rejected (403)', r.status === 403, `${r.status}`);
  }

  // 2) create company
  let companyId;
  {
    const r = await api('create_company', { name: 'Phase2 Co', allowed_email_domain: 'acme.com', max_users: 3, daily_practice_limit: 5, monthly_practice_limit: 50, max_jds_per_user: 2 }, adminTok);
    companyId = r.body?.company?.id;
    check('2 create_company', r.status === 200 && companyId && r.body.company.status === 'active' && r.body.company.allowed_email_domain === 'acme.com', `${r.status}`);
  }

  // 3) list companies includes it
  {
    const r = await api('list_companies', {}, adminTok);
    check('3 list_companies includes new + counts', r.status === 200 && (r.body.companies || []).some((c) => c.id === companyId && 'members' in c));
  }

  // 4) update company
  {
    const r = await api('update_company', { id: companyId, patch: { daily_practice_limit: 7 } }, adminTok);
    check('4 update_company', r.status === 200 && r.body.company.daily_practice_limit === 7);
  }

  // 5) invite manager
  {
    const r = await api('invite_manager', { company_id: companyId, email: 'MGR@acme.com' }, adminTok);
    check('5 invite_manager', r.status === 200 && r.body.invitation?.role === 'manager' && r.body.invitation?.email === 'mgr@acme.com' && r.body.invitation?.status === 'pending');
  }

  // 6) list members shows pending invite
  {
    const r = await api('list_members', { company_id: companyId }, adminTok);
    check('6 list_members shows pending invite', r.status === 200 && (r.body.pending || []).some((p) => p.email === 'mgr@acme.com'));
  }

  // 7) company JD lifecycle: upload → list → update → delete
  {
    const up = await api('upload_company_jd', { company_id: companyId, title: 'Company JD', content: 'Shared JD content for the team.' }, adminTok);
    const jdId = up.body.jd?.id;
    const list = await api('list_company_jds', { company_id: companyId }, adminTok);
    const upd = await api('update_company_jd', { id: jdId, title: 'Company JD v2', content: 'Updated content.' }, adminTok);
    const del = await api('delete_company_jd', { id: jdId }, adminTok);
    const list2 = await api('list_company_jds', { company_id: companyId }, adminTok);
    check('7 company JD upload/list/update/delete',
      up.status === 200 && up.body.jd?.visibility === 'company' &&
      list.status === 200 && (list.body.jds || []).some((j) => j.id === jdId) &&
      upd.status === 200 && upd.body.jd?.title === 'Company JD v2' &&
      del.status === 200 && !(list2.body.jds || []).some((j) => j.id === jdId));
  }

  // Seat p2-user as a member for the role / ban / removal cases.
  await setProfile(userId, USER_EMAIL, { company_id: companyId, plan: 'corporate' });
  const teamStatus = async (tok) => (await fetch(`${BASE}/api/team`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'overview' }) })).status;

  // 7b) list_users lists ALL accounts, annotating a corporate member with their company
  {
    const users = await api('list_users', { search: 'p2-user' }, adminTok);
    check('7b list_users shows corporate member with company label', users.status === 200 && (users.body.users || []).some((u) => u.id === userId && u.company === 'Phase2 Co'), '');
  }

  // 8) domain_mode='manager' → promoting a member derives the invite domain from their email + grants team access
  {
    await api('update_company', { id: companyId, patch: { domain_mode: 'manager' } }, adminTok);
    const r = await api('set_member_role', { user_id: userId, role: 'manager' }, adminTok);
    const comp = (await dbRow(`/rest/v1/companies?select=allowed_email_domain&id=eq.${companyId}`))[0];
    const ov = await teamStatus(userTok);
    check('8 manager-mode promote (domain follows + team access)', r.status === 200 && r.body.role === 'manager' && comp.allowed_email_domain === 'spiko-test.example' && ov === 200, `domain=${comp.allowed_email_domain} team=${ov}`);
    await api('set_member_role', { user_id: userId, role: 'employee' }, adminTok);
  }
  // 9) domain_mode='any' → promoting does NOT set a domain; demote removes team access
  {
    await api('update_company', { id: companyId, patch: { domain_mode: 'any' } }, adminTok);
    const r = await api('set_member_role', { user_id: userId, role: 'manager' }, adminTok);
    const comp = (await dbRow(`/rest/v1/companies?select=allowed_email_domain&id=eq.${companyId}`))[0];
    const ov = await teamStatus(userTok);
    await api('set_member_role', { user_id: userId, role: 'employee' }, adminTok);
    const ov2 = await teamStatus(userTok);
    check('9 any-mode promote (no domain filter) + demote removes access', r.status === 200 && comp.allowed_email_domain === null && ov === 200 && ov2 === 403, `domain=${comp.allowed_email_domain} team=${ov}->${ov2}`);
  }
  // 10) B2C ban blocks login; unban restores; validations (already_banned / not_banned / user_not_found)
  {
    const b = await api('ban_user', { email: USER_EMAIL, banned: true }, adminTok);
    const bannedTok = await token(USER_EMAIL);
    const again = await api('ban_user', { email: USER_EMAIL, banned: true }, adminTok);
    const u = await api('ban_user', { email: USER_EMAIL, banned: false }, adminTok);
    const okTok = await token(USER_EMAIL);
    const notBanned = await api('ban_user', { email: USER_EMAIL, banned: false }, adminTok);
    const missing = await api('ban_user', { email: `ghost-${Date.now()}@none.example`, banned: true }, adminTok);
    check('10 ban/unban + validations',
      b.status === 200 && !bannedTok && again.status === 409 && again.body.error === 'already_banned' &&
      u.status === 200 && !!okTok && notBanned.status === 409 && notBanned.body.error === 'not_banned' &&
      missing.status === 404, `again=${again.status} notBanned=${notBanned.status} missing=${missing.status}`);
  }
  // 11) B2B remove_from_company → free individual, then appears in the B2C list
  {
    const r = await api('remove_from_company', { user_id: userId }, adminTok);
    const prof = (await dbRow(`/rest/v1/profiles?select=company_id,plan,role&id=eq.${userId}`))[0];
    const users = await api('list_users', { search: 'p2-user' }, adminTok);
    check('11 remove_from_company → free individual + in users list',
      r.status === 200 && prof.company_id === null && prof.plan === 'free' &&
      (users.body.users || []).some((u) => u.id === userId && u.banned === false && u.company === null), JSON.stringify(prof));
  }
  // 11b) delete_user hard-resets a B2C account; corporate members are protected
  {
    const delEmail = 'p2-del@spiko-test.example';
    const delId = await ensureUser(delEmail); await setProfile(delId, delEmail, { company_id: null, plan: 'free' });
    const corpEmail = 'p2-corp@spiko-test.example';
    const corpId = await ensureUser(corpEmail); await setProfile(corpId, corpEmail, { company_id: companyId, plan: 'corporate' });
    const blocked = await api('delete_user', { user_id: corpId }, adminTok);
    const del = await api('delete_user', { user_id: delId }, adminTok);
    const gone = await dbRow(`/rest/v1/profiles?select=id&id=eq.${delId}`);
    check('11b delete_user (B2C hard reset; corporate protected)',
      blocked.status === 409 && blocked.body.error === 'user_is_corporate' && del.status === 200 && gone.length === 0,
      `corp=${blocked.status}:${blocked.body.error} del=${del.status} gone=${gone.length}`);
  }

  // 12) suspend company
  {
    const r = await api('suspend_company', { id: companyId, suspended: true }, adminTok);
    const row = (await dbRow(`/rest/v1/companies?select=status&id=eq.${companyId}`))[0];
    check('12 suspend_company', r.status === 200 && row.status === 'suspended');
  }

  // 13) update settings (then restore)
  {
    const before = (await dbRow('/rest/v1/platform_settings?select=free_monthly_sessions&id=eq.1'))[0].free_monthly_sessions;
    const r = await api('update_settings', { patch: { free_monthly_sessions: 7 } }, adminTok);
    const now = (await dbRow('/rest/v1/platform_settings?select=free_monthly_sessions&id=eq.1'))[0].free_monthly_sessions;
    check('13 update_settings', r.status === 200 && now === 7);
    await api('update_settings', { patch: { free_monthly_sessions: before } }, adminTok); // restore
  }

  // 14) delete company detaches members
  {
    const r = await api('delete_company', { id: companyId }, adminTok);
    const comp = await dbRow(`/rest/v1/companies?select=id&id=eq.${companyId}`);
    const prof = (await dbRow(`/rest/v1/profiles?select=company_id&id=eq.${userId}`))[0];
    check('14 delete_company (gone + member detached)', r.status === 200 && comp.length === 0 && prof.company_id === null);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? '❌ ' + failed.length + ' FAILED' : '✅ ALL ' + results.length + ' PASSED'}`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
