// Idempotent: super-admin on/off flag controlling whether FREE individuals may
// enter the dashboard. Default false = free users see the paywall gate.
// Run: node scripts/migrate-free-dashboard-flag.mjs
import fs from 'node:fs';
const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim(); if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const REF = env.SUPABASE_PROJECT_REF, TOKEN = env.SUPABASE_ACCESS_TOKEN;
const q = async (query) => (await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})).json();
console.log('migrate:', JSON.stringify(await q(
  `alter table platform_settings add column if not exists free_dashboard_enabled boolean not null default false;`,
)));
console.log('row:', JSON.stringify(await q(`select id, free_dashboard_enabled from platform_settings where id=1;`)));
