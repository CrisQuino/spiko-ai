// Playwright global setup: seeds the accounts the UI specs log in as, using the
// Supabase service role (resolved via the Management API). Idempotent — creates
// users only if missing (never resets an existing password), and ensures the
// E2E company + a seated manager and member exist.
import fs from 'node:fs';
import { ADMIN_EMAIL, ADMIN_PW, MANAGER_EMAIL, MEMBER_EMAIL, TEAM_PW, COMPANY_NAME, COMPANY_SLUG } from './fixtures';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return env;
}

export default async function globalSetup() {
  const env = loadEnv();
  const URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const REF = env.SUPABASE_PROJECT_REF;
  const SBP = env.SUPABASE_ACCESS_TOKEN;
  if (!URL || !REF || !SBP) { console.warn('[global-setup] missing Supabase env; skipping seed'); return; }

  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${SBP}` } })).json();
  const service = (keys as any[]).find((k) => k.name === 'service_role')?.api_key;
  if (!service) { console.warn('[global-setup] no service_role key; skipping seed'); return; }
  const h = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };

  const ensureUser = async (email: string, password: string): Promise<string> => {
    const c = await (await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: h, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
    if ((c as any).id) return (c as any).id;
    const list = await (await fetch(`${URL}/auth/v1/admin/users?per_page=2000`, { headers: h })).json();
    return ((list as any).users || []).find((u: any) => u.email === email)?.id;
  };
  const setProfile = async (id: string, email: string, patch: Record<string, unknown>) => {
    await fetch(`${URL}/rest/v1/profiles`, { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, email, full_name: email.split('@')[0], role: 'employee', company_id: null, plan: 'free', status: 'active', ...patch }) });
  };

  // Super-admin (dashboard allowlist) for the admin panel spec.
  const adminId = await ensureUser(ADMIN_EMAIL, ADMIN_PW);
  if (adminId) await setProfile(adminId, ADMIN_EMAIL, {});

  // A corporate company with a manager + a member for the team panel spec.
  await fetch(`${URL}/rest/v1/companies?slug=eq.${COMPANY_SLUG}`, { method: 'DELETE', headers: h });
  const compRow = await (await fetch(`${URL}/rest/v1/companies`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ name: COMPANY_NAME, slug: COMPANY_SLUG, plan: 'corporate', status: 'active', max_users: 5, domain_mode: 'any' }) })).json();
  const companyId = Array.isArray(compRow) ? (compRow[0] as any).id : (compRow as any).id;

  const mgrId = await ensureUser(MANAGER_EMAIL, TEAM_PW);
  if (mgrId) await setProfile(mgrId, MANAGER_EMAIL, { company_id: companyId, role: 'manager', plan: 'corporate' });
  const memId = await ensureUser(MEMBER_EMAIL, TEAM_PW);
  if (memId) await setProfile(memId, MEMBER_EMAIL, { company_id: companyId, role: 'employee', plan: 'corporate' });

  console.log('[global-setup] seeded admin + company + manager + member');
}
