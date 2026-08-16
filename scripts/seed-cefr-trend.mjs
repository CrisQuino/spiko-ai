// Seeds realistic mock practice sessions (lesson_costs) so the CEFR target-vs-
// assessed trend chart has a good multi-day curve on the individual + company
// dashboards. Idempotent: tagged scenario_type='mock_seed' and cleared first.
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); env[t.slice(0, i).trim()] = t.slice(i + 1).trim(); }
const REF = env.SUPABASE_PROJECT_REF, SBP = env.SUPABASE_ACCESS_TOKEN, URL = env.NEXT_PUBLIC_SUPABASE_URL;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const langs = ['en', 'en', 'en', 'fr', 'pt']; // mostly EN, some FR/PT for the language filter

const q = async (sql) => (await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })).json();

async function main() {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${SBP}` } })).json();
  const svc = keys.find((k) => k.name === 'service_role').api_key;
  const h = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  const users = await q(`select id, email from profiles where email in ('spiko-e2e@example.com','cquino_11@hotmail.com','dash.crs@gmail.com')`);
  if (!users.length) { console.log('no target users'); return; }

  // Clear previous mock rows for these users.
  const ids = users.map((u) => `'${u.id}'`).join(',');
  await q(`delete from lesson_costs where scenario_type='mock_seed' and user_id in (${ids})`);

  const now = Date.now();
  const rows = [];
  for (const u of users) {
    for (let day = 13; day >= 0; day--) {
      const sessions = 1 + Math.floor(Math.random() * 3); // 1..3 per day
      for (let s = 0; s < sessions; s++) {
        const lang = langs[Math.floor(Math.random() * langs.length)];
        // Target: mostly B2, sometimes C1. Assessed: climbs A2→B2 over the window.
        const target = Math.random() < 0.2 ? 4 : 3;
        const base = 1 + ((13 - day) / 13) * 2.3;                 // ~1 (A2) → ~3.3 (B2+)
        const assessed = clamp(Math.round(base + (Math.random() - 0.5) * 1.3), 0, 5);
        const when = new Date(now - day * 86400000 - Math.floor(Math.random() * 8 * 3600000));
        const tokens = 9000 + Math.floor(Math.random() * 6000);
        rows.push({
          lesson_id: crypto.randomUUID(), user_id: u.id, scenario_type: 'mock_seed',
          started_at: when.toISOString(), completed_at: when.toISOString(),
          duration_seconds: 150 + Math.floor(Math.random() * 120),
          total_tokens: tokens, total_cost: +(tokens * 0.0000035).toFixed(5),
          language: lang, target_level: LEVELS[target], cefr_overall: LEVELS[assessed],
          scenario_title: `Backend Engineer — ${LEVELS[target]} (${lang.toUpperCase()})`,
        });
      }
    }
  }

  // Insert in batches.
  for (let i = 0; i < rows.length; i += 200) {
    const r = await fetch(`${URL}/rest/v1/lesson_costs`, { method: 'POST', headers: h, body: JSON.stringify(rows.slice(i, i + 200)) });
    if (!r.ok) { console.error('insert failed', r.status, await r.text()); return; }
  }
  console.log(`✓ seeded ${rows.length} mock sessions for ${users.map((u) => u.email).join(', ')}`);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
