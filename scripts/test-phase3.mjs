// E2E for Phase 3 — manager team API (/api/team) + invitation acceptance
// (/api/invite/accept). Seeds a company + manager with the service role, then
// exercises every manager action and the full invite→accept lifecycle with real
// user tokens against the running dev server. Prints PASS/FAIL and exits non-zero.
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
const PW = 'Phase3-test-Passw0rd!';
const DOMAIN = 'p3team.example';

let service;
const admin = (p, o = {}) => fetch(`${SUPABASE_URL}${p}`, { ...o, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(o.headers || {}) } });
async function ensureUser(email) {
  const c = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password: PW, email_confirm: true }) })).json();
  if (c.id) return c.id;
  const list = await (await admin('/auth/v1/admin/users?per_page=2000')).json();
  return (list.users || []).find((u) => u.email === email)?.id;
}
async function setProfile(id, email, patch) {
  await admin('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, email, full_name: email.split('@')[0], role: 'employee', company_id: null, plan: 'free', status: 'active', ...patch }) });
}
async function token(email) {
  return (await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json()).access_token;
}
async function makeCompany(name, patch) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-p3';
  await admin(`/rest/v1/companies?slug=eq.${slug}`, { method: 'DELETE' });
  const row = await (await admin('/rest/v1/companies', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, slug, plan: 'corporate', status: 'active', ...patch }) })).json();
  return Array.isArray(row) ? row[0].id : row.id;
}
const dbRow = async (path) => await (await admin(path)).json();
const team = async (action, params, tok) => {
  const r = await fetch(`${BASE}/api/team`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action, ...params }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const accept = async (inviteToken, tok) => {
  const r = await fetch(`${BASE}/api/invite/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ token: inviteToken }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${SBP}` } })).json();
  service = keys.find((k) => k.name === 'service_role').api_key;

  const cid = await makeCompany('P3 Team Co', { max_users: 3, allowed_email_domain: DOMAIN });

  const mgrEmail = `manager@${DOMAIN}`, aliceEmail = `alice@${DOMAIN}`, bobEmail = `bob@${DOMAIN}`, outsiderEmail = 'outsider@other.example';
  const mgrId = await ensureUser(mgrEmail); await setProfile(mgrId, mgrEmail, { company_id: cid, role: 'manager', plan: 'corporate' });
  const aliceId = await ensureUser(aliceEmail); await setProfile(aliceId, aliceEmail, { company_id: null, role: 'employee', plan: 'free' });
  const bobId = await ensureUser(bobEmail); await setProfile(bobId, bobEmail, { company_id: null, role: 'employee', plan: 'free' });
  const outsiderId = await ensureUser(outsiderEmail); await setProfile(outsiderId, outsiderEmail, { company_id: null, role: 'employee', plan: 'free' });
  // Clean any leftover invitations for these emails from prior runs.
  for (const e of [aliceEmail, bobEmail, `carol@${DOMAIN}`, 'bad@wrong.example']) await admin(`/rest/v1/invitations?email=eq.${encodeURIComponent(e)}&company_id=eq.${cid}`, { method: 'DELETE' });

  const mgrTok = await token(mgrEmail), aliceTok = await token(aliceEmail), bobTok = await token(bobEmail), outsiderTok = await token(outsiderEmail);

  // 1) non-manager rejected
  check('1 non-manager rejected (403)', (await team('overview', {}, outsiderTok)).status === 403);

  // 2) overview
  {
    const r = await team('overview', {}, mgrTok);
    const seats = r.body?.seats;
    check('2 overview (manager member + seats)', r.status === 200 && r.body.members.some((m) => m.id === mgrId) && seats.active >= 1 && seats.max === 3 && 'sessions' in r.body.members[0]);
  }

  // 3) domain mismatch
  {
    const r = await team('invite_member', { email: 'bad@wrong.example' }, mgrTok);
    check('3 invite domain_mismatch blocked', r.status === 400 && r.body.error === 'domain_mismatch', `${r.status}:${r.body.error}`);
  }

  // 4) invite alice
  let aliceInvite;
  {
    const r = await team('invite_member', { email: aliceEmail }, mgrTok);
    aliceInvite = r.body?.invitation?.token;
    check('4 invite alice', r.status === 200 && r.body.invitation.role === 'employee' && r.body.invitation.status === 'pending' && !!aliceInvite);
  }

  // 5) invite bob (now active1 + pending2 = 3 = cap)
  check('5 invite bob', (await team('invite_member', { email: bobEmail }, mgrTok)).status === 200);

  // 6) carol exceeds seats
  {
    const r = await team('invite_member', { email: `carol@${DOMAIN}` }, mgrTok);
    check('6 invite carol seats_full', r.status === 409 && r.body.error === 'seats_full', `${r.status}:${r.body.error}`);
  }

  // 7) duplicate invite
  {
    const r = await team('invite_member', { email: aliceEmail }, mgrTok);
    check('7 duplicate invite already_invited', r.status === 409 && r.body.error === 'already_invited', `${r.status}:${r.body.error}`);
  }

  // 8) email mismatch on accept (bob accepting alice's invite)
  {
    const r = await accept(aliceInvite, bobTok);
    check('8 accept email_mismatch blocked', r.status === 403 && r.body.error === 'email_mismatch', `${r.status}:${r.body.error}`);
  }

  // 9) cancel bob invite
  {
    const inv = (await dbRow(`/rest/v1/invitations?select=id&company_id=eq.${cid}&email=eq.${encodeURIComponent(bobEmail)}&status=eq.pending`))[0];
    const r = await team('cancel_invite', { invitation_id: inv.id }, mgrTok);
    const still = await dbRow(`/rest/v1/invitations?select=id&company_id=eq.${cid}&email=eq.${encodeURIComponent(bobEmail)}&status=eq.pending`);
    check('9 cancel_invite', r.status === 200 && still.length === 0);
  }

  // 10) alice accepts
  {
    const r = await accept(aliceInvite, aliceTok);
    const prof = (await dbRow(`/rest/v1/profiles?select=company_id,role,plan,status&id=eq.${aliceId}`))[0];
    check('10 alice accepts invite', r.status === 200 && prof.company_id === cid && prof.role === 'employee' && prof.plan === 'corporate', JSON.stringify(prof));
  }

  // 11) already a member
  {
    const r = await team('invite_member', { email: aliceEmail }, mgrTok);
    check('11 invite existing member already_member', r.status === 409 && r.body.error === 'already_member', `${r.status}:${r.body.error}`);
  }

  // 12) invitation already used
  {
    const r = await accept(aliceInvite, aliceTok);
    check('12 re-accept used invite blocked', r.status === 400 && r.body.error === 'used', `${r.status}:${r.body.error}`);
  }

  // 13) cannot remove self
  check('13 remove self blocked', (await team('remove_member', { user_id: mgrId }, mgrTok)).body.error === 'cannot_remove_self');

  // 14) remove someone not in team
  {
    const r = await team('remove_member', { user_id: '00000000-0000-0000-0000-000000000000' }, mgrTok);
    check('14 remove not_in_team', r.status === 404 && r.body.error === 'not_in_team', `${r.status}:${r.body.error}`);
  }

  // 15) remove alice → she becomes a free individual (detached from the company)
  {
    const r = await team('remove_member', { user_id: aliceId }, mgrTok);
    const prof = (await dbRow(`/rest/v1/profiles?select=company_id,plan,role&id=eq.${aliceId}`))[0];
    check('15 remove_member → free individual', r.status === 200 && prof.company_id === null && prof.plan === 'free' && prof.role === 'employee', JSON.stringify(prof));
  }

  // 16) manager cannot be removed by another manager (seat a 2nd manager)
  {
    const m2 = `mgr2@${DOMAIN}`; const m2id = await ensureUser(m2); await setProfile(m2id, m2, { company_id: cid, role: 'manager', plan: 'corporate' });
    const r = await team('remove_member', { user_id: m2id }, mgrTok);
    check('16 cannot remove another manager', r.status === 403 && r.body.error === 'cannot_remove_manager', `${r.status}:${r.body.error}`);
    await admin(`/rest/v1/profiles?id=eq.${m2id}`, { method: 'PATCH', body: JSON.stringify({ company_id: null, role: 'employee' }) });
  }

  // 17) analytics returns company-scoped lessons array
  {
    const r = await team('analytics', {}, mgrTok);
    check('17 analytics returns lessons array', r.status === 200 && Array.isArray(r.body.lessons), `${r.status}`);
  }
  // 18) set_domain_mode: 'manager' derives domain from the manager; 'any' clears it
  {
    const m = await team('set_domain_mode', { mode: 'manager' }, mgrTok);
    const dm = (await dbRow(`/rest/v1/companies?select=domain_mode,allowed_email_domain&id=eq.${cid}`))[0];
    const a = await team('set_domain_mode', { mode: 'any' }, mgrTok);
    const dm2 = (await dbRow(`/rest/v1/companies?select=allowed_email_domain&id=eq.${cid}`))[0];
    check('18 set_domain_mode manager/any', m.status === 200 && dm.domain_mode === 'manager' && dm.allowed_email_domain === DOMAIN && a.status === 200 && dm2.allowed_email_domain === null, `d=${dm.allowed_email_domain}`);
  }
  // 19) set_member_role co-manager promote + demote (within own company)
  {
    const em = `coemp@${DOMAIN}`; const id = await ensureUser(em); await setProfile(id, em, { company_id: cid, role: 'employee', plan: 'corporate' });
    const p = await team('set_member_role', { user_id: id, role: 'manager' }, mgrTok);
    const r1 = (await dbRow(`/rest/v1/profiles?select=role&id=eq.${id}`))[0].role;
    const dd = await team('set_member_role', { user_id: id, role: 'employee' }, mgrTok);
    const r2 = (await dbRow(`/rest/v1/profiles?select=role&id=eq.${id}`))[0].role;
    check('19 set_member_role promote/demote', p.status === 200 && r1 === 'manager' && dd.status === 200 && r2 === 'employee', `${r1}->${r2}`);
  }
  // 20) manager company-JD CRUD (upload → list → update → delete)
  {
    const up = await team('upload_company_jd', { title: 'Team JD', content: 'Shared team content.' }, mgrTok);
    const jid = up.body.jd?.id;
    const list = await team('list_company_jds', {}, mgrTok);
    const upd = await team('update_company_jd', { id: jid, title: 'Team JD v2', content: 'Updated.' }, mgrTok);
    const del = await team('delete_company_jd', { id: jid }, mgrTok);
    const list2 = await team('list_company_jds', {}, mgrTok);
    check('20 manager company JD CRUD',
      up.status === 200 && up.body.jd?.visibility === 'company' && (list.body.jds || []).some((j) => j.id === jid) &&
      upd.status === 200 && upd.body.jd?.title === 'Team JD v2' && del.status === 200 && !(list2.body.jds || []).some((j) => j.id === jid));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? '❌ ' + failed.length + ' FAILED' : '✅ ALL ' + results.length + ' PASSED'}`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
