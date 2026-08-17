// Idempotent: payments table for Wompi B2C checkout.
// Run: node scripts/migrate-payments-table.mjs
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

const sql = `
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  user_id uuid references profiles(id) on delete set null,
  email text,
  amount_in_cents integer not null,
  currency text not null default 'COP',
  status text not null default 'PENDING',
  transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table payments enable row level security;
drop policy if exists payments_own_read on payments;
create policy payments_own_read on payments for select using (auth.uid() = user_id);
create index if not exists payments_user_idx on payments(user_id);
`;
console.log('migrate:', JSON.stringify(await q(sql)));
console.log('cols:', JSON.stringify(await q(`select column_name from information_schema.columns where table_name='payments' order by ordinal_position;`)));
