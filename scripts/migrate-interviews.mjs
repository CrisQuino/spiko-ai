// Enterprise quick-interview module + per-company transcript policy.
// Run: node scripts/migrate-interviews.mjs
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
-- Per-company live-transcript policy (Enterprise config at creation):
--   'default' = level-based scaling (A1-B1 full, B2 partial, C1+ hidden live)
--   'always'  = always show the live transcript
--   'hidden'  = always hide the live transcript (strict listening / interviews)
alter table companies add column if not exists transcript_policy text not null default 'default';

create table if not exists interview_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  company_id uuid references companies(id) on delete cascade,
  manager_id uuid references profiles(id) on delete set null,
  candidate_email text not null,
  candidate_name text,
  language text not null default 'en',
  level text,
  jd_title text,
  jd_content text,
  status text not null default 'sent',            -- sent | started | completed | expired
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '21 days'),
  started_at timestamptz,
  completed_at timestamptz,
  cefr_overall text,
  pronunciation_score integer, fluency_score integer, vocabulary_score integer,
  grammar_score integer, interaction_score integer, comprehension_score integer,
  overall_score integer,
  final_feedback text,
  transcript jsonb
);
alter table interview_invites enable row level security;
create index if not exists interview_invites_company_idx on interview_invites(company_id, created_at desc);
create index if not exists interview_invites_token_idx on interview_invites(token);`;
console.log('migrate:', JSON.stringify(await q(sql)));
console.log('companies.transcript_policy present:', JSON.stringify(await q(`select column_name from information_schema.columns where table_name='companies' and column_name='transcript_policy';`)));
console.log('interview_invites cols:', JSON.stringify((await q(`select column_name from information_schema.columns where table_name='interview_invites' order by ordinal_position;`)).map?.(r=>r.column_name) ?? 'n/a'));
