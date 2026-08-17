// Idempotent migration: expose profiles.plan on admin_lessons_detail so the
// dashboards can classify each lesson's channel (free / B2C / B2B).
// Run: node scripts/migrate-view-plan.mjs
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

// CREATE OR REPLACE only allows APPENDING columns — keep the existing order and
// add p.plan at the very end.
const sql = `create or replace view admin_lessons_detail as
  select lc.lesson_id, lc.user_id, p.email, lc.completed_at,
         coalesce(lc.language, 'unknown') as language,
         coalesce(lc.total_cost, 0) as total_cost,
         coalesce(lc.total_tokens, 0) as total_tokens,
         lc.cefr_overall, lc.target_level, lc.duration_seconds, lc.scenario_title,
         p.company_id, c.name as company_name, coalesce(p.plan, 'free') as plan
  from lesson_costs lc
    left join profiles p on p.id = lc.user_id
    left join companies c on c.id = p.company_id
  where lc.completed_at is not null;`;
console.log('migrate:', JSON.stringify(await q(sql)));
console.log('sample:', JSON.stringify(await q(`select plan, count(*) n from admin_lessons_detail group by plan order by n desc;`)));
