// Seed several demo users with synthetic completed lessons (NO LLM cost) so the
// admin top_users panel has enough rows to scroll and the per-user filter can be
// exercised. Idempotent-ish: deletes prior demo-seed lessons before inserting.
// Rows are tagged scenario_type='demo-seed' so scripts/clean-demo-users.mjs (or a
// DELETE where scenario_type='demo-seed') can remove them.
import crypto from 'crypto';
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

const N_USERS = Number(process.env.DEMO_USERS || 9);
const PASSWORD = 'Demo-user-Passw0rd!';
const LANGS = ['en', 'fr', 'pt'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (min, max) => Math.floor(min + Math.random() * (max - min));

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

  const summary = [];
  for (let u = 1; u <= N_USERS; u++) {
    const email = `demo-user-${String(u).padStart(2, '0')}@spiko-demo.test`;
    const fullName = `Demo User ${u}`;

    // create or find the user
    let userId = null;
    const created = await (await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    })).json();
    if (created.id) userId = created.id;
    else {
      const list = await (await admin(`/auth/v1/admin/users?per_page=500`)).json();
      const found = (list.users || []).find((x) => x.email === email);
      if (!found) throw new Error('cannot create/find ' + email + ': ' + JSON.stringify(created));
      userId = found.id;
    }

    // ensure a profiles row (for the email/name shown in admin views)
    await admin('/rest/v1/profiles', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: userId, email, full_name: fullName, role: 'employee' }),
    });

    // clear this user's prior demo-seed lessons, then insert fresh ones
    await admin(`/rest/v1/lesson_costs?user_id=eq.${userId}&scenario_type=eq.demo-seed`, { method: 'DELETE' });

    const nLessons = rnd(2, 7);
    const rows = [];
    for (let k = 0; k < nLessons; k++) {
      const input = rnd(4000, 26000);
      const output = rnd(300, 3000);
      const totalCost = (input / 1_000_000) * 3 + (output / 1_000_000) * 15;
      const daysAgo = rnd(0, 16);
      const when = new Date(Date.now() - daysAgo * 86400000 - rnd(0, 80000) * 1000).toISOString();
      const lang = pick(LANGS);
      const target = pick(LEVELS);
      rows.push({
        id: crypto.randomUUID(),
        lesson_id: crypto.randomUUID(),
        user_id: userId,
        scenario_type: 'demo-seed',
        scenario_title: `Demo — ${lang.toUpperCase()} ${target}`,
        started_at: when,
        completed_at: when,
        duration_seconds: rnd(90, 300),
        total_tokens: input + output,
        input_tokens: input,
        output_tokens: output,
        input_cost: Number(((input / 1_000_000) * 3).toFixed(6)),
        output_cost: Number(((output / 1_000_000) * 15).toFixed(6)),
        total_cost: Number(totalCost.toFixed(6)),
        cefr_overall: pick(LEVELS),
        target_level: target,
        language: lang,
      });
    }
    await admin('/rest/v1/lesson_costs', { method: 'POST', body: JSON.stringify(rows) });
    summary.push({ email, userId, lessons: rows.length });
  }

  console.log(JSON.stringify({ created: summary.length, users: summary }, null, 2));
}

main().catch((e) => {
  console.error('SEED_DEMO_ERROR', e);
  process.exit(1);
});
