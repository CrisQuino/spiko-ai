// E2E cleanup: delete the test user (cascades to profile, JDs and lessons).
import fs from 'fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim();
  if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('=');
  env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = env.SUPABASE_PROJECT_REF;
const SBP = env.SUPABASE_ACCESS_TOKEN;
const EMAIL = process.env.E2E_EMAIL || 'spiko-e2e@example.com';

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
    headers: { Authorization: `Bearer ${SBP}` },
  })).json();
  const serviceRole = keys.find((k) => k.name === 'service_role').api_key;
  const admin = (path, opts = {}) =>
    fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });

  const list = await (await admin('/auth/v1/admin/users?per_page=200')).json();
  const u = (list.users || []).find((x) => x.email === EMAIL);
  if (!u) {
    console.log('No test user found; nothing to clean.');
    return;
  }
  // Remove lessons + JDs first (in case FKs are not ON DELETE CASCADE), then the user.
  await admin(`/rest/v1/lesson_costs?user_id=eq.${u.id}`, { method: 'DELETE' });
  await admin(`/rest/v1/job_descriptions?user_id=eq.${u.id}`, { method: 'DELETE' });
  const del = await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  console.log('Deleted test user', u.id, '→ status', del.status);
}

main().catch((e) => { console.error('CLEANUP_ERROR', e); process.exit(1); });
