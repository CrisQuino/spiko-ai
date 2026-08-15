// E2E seed (idempotent, persistent): create a confirmed test user + two JDs
// (one leadership, one individual-contributor). Prints creds as JSON.
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
const PASSWORD = process.env.E2E_PASSWORD || 'Test-e2e-Passw0rd!';

const JDS = [
  {
    title: 'Director, Software Engineering',
    content:
      'Director of Software Engineering. Strategic leadership role. Leads multiple cross-functional engineering teams building mission-critical, cloud-native payment platforms on GCP. Owns delivery, budget, hiring, and technical direction across teams. Responsibilities: set engineering strategy and priorities; manage timelines and budgets; coach and unblock managers and staff engineers; align with product, finance and executive stakeholders; drive quality, reliability and operational excellence; report status and risk to VPs. This is a people-and-decisions leadership role, not an individual-contributor coding role.',
  },
  {
    title: 'Backend Engineer',
    content:
      'Backend Engineer (individual contributor). Hands-on role. Designs, builds, tests and maintains REST APIs and microservices in Node.js and PostgreSQL. Writes and reviews code, fixes bugs, optimizes SQL queries, adds tests, participates in on-call, and debugs production incidents directly (reading logs, tracing requests, running commands). Not a management or people-leadership role.',
  },
];

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
    headers: { Authorization: `Bearer ${SBP}` },
  })).json();
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

  // user (create or find)
  let userId = null;
  const created = await (await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  })).json();
  if (created.id) userId = created.id;
  else {
    const list = await (await admin('/auth/v1/admin/users?per_page=200')).json();
    const u = (list.users || []).find((x) => x.email === EMAIL);
    if (!u) throw new Error('Could not create or find test user: ' + JSON.stringify(created));
    userId = u.id;
  }

  // JDs (replace any existing test JDs so re-seeding is clean)
  const jdIds = {};
  for (const jd of JDS) {
    await admin(`/rest/v1/job_descriptions?user_id=eq.${userId}&title=eq.${encodeURIComponent(jd.title)}`, {
      method: 'DELETE',
    });
    const row = await (await admin('/rest/v1/job_descriptions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, title: jd.title, content: jd.content }),
    })).json();
    jdIds[jd.title] = Array.isArray(row) ? row[0].id : row.id;
  }

  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, userId, jdIds }));
}

main().catch((e) => {
  console.error('SEED_ERROR', e);
  process.exit(1);
});
