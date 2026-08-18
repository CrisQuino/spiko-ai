// Public, read-only view exposing ONLY the plan limits (not margin) so the
// landing pricing cards can show live limits to anonymous visitors.
// Run: node scripts/migrate-public-plan-limits.mjs
import fs from 'node:fs';
const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = line.trim(); if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const REF = env.SUPABASE_PROJECT_REF, TOKEN = env.SUPABASE_ACCESS_TOKEN;
const q = async (query) => (await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
})).json();

const sql = `
create or replace view public_plan_limits as
  select free_monthly_sessions, free_max_jds, premium_max_jds
  from platform_settings where id = 1;
grant select on public_plan_limits to anon, authenticated;`;
console.log('migrate:', JSON.stringify(await q(sql)));
console.log('view:', JSON.stringify(await q(`select * from public_plan_limits;`)));
