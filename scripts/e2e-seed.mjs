// E2E seed: create a confirmed test user + a Director JD. Prints creds as JSON.
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

const EMAIL = 'spiko-e2e@example.com';
const PASSWORD = 'Test-e2e-Passw0rd!';
const JD_TITLE = 'Director, Software Engineering';
const JD_CONTENT = `Director of Software Engineering. Strategic leadership role. Leads multiple cross-functional engineering teams building mission-critical, cloud-native payment platforms on GCP. Owns delivery, budget, hiring, and technical direction across teams. Responsibilities: set engineering strategy and priorities; manage timelines and budgets; coach and unblock managers and staff engineers; align with product, finance and executive stakeholders; drive quality, reliability and operational excellence; report status and risk to VPs. This is a people-and-decisions leadership role, not an individual-contributor coding role.`;

async function main() {
  // 1) service_role key
  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
    headers: { Authorization: `Bearer ${SBP}` },
  });
  const keys = await keysRes.json();
  const serviceRole = keys.find((k) => k.name === 'service_role').api_key;

  const admin = (path, opts = {}) =>
    fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });

  // 2) create (or find) confirmed user
  let userId = null;
  const createRes = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const created = await createRes.json();
  if (created.id) {
    userId = created.id;
  } else {
    // already exists → look it up
    const listRes = await admin(`/auth/v1/admin/users?per_page=200`);
    const list = await listRes.json();
    const u = (list.users || []).find((x) => x.email === EMAIL);
    if (!u) throw new Error('Could not create or find test user: ' + JSON.stringify(created));
    userId = u.id;
  }

  // 3) ensure a JD exists for this user (delete old test JDs, insert fresh)
  await admin(`/rest/v1/job_descriptions?user_id=eq.${userId}&title=eq.${encodeURIComponent(JD_TITLE)}`, {
    method: 'DELETE',
  });
  const jdRes = await admin('/rest/v1/job_descriptions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title: JD_TITLE, content: JD_CONTENT }),
  });
  const jd = await jdRes.json();
  const jdId = Array.isArray(jd) ? jd[0].id : jd.id;

  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, userId, jdId }));
}

main().catch((e) => {
  console.error('SEED_ERROR', e);
  process.exit(1);
});
