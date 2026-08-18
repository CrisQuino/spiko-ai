// Contact Sales inbox: messages from the Enterprise "Contact Sales" form.
// Run: node scripts/migrate-contact-messages.mjs
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

// RLS on, NO policies: only the service role (the /api/contact + /api/admin
// routes) can insert/read. The public form posts through the service-role route.
const sql = `
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  company text,
  email text,
  name text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table contact_messages enable row level security;
create index if not exists contact_messages_status_idx on contact_messages(status, created_at desc);`;
console.log('migrate:', JSON.stringify(await q(sql)));
console.log('cols:', JSON.stringify(await q(`select column_name from information_schema.columns where table_name='contact_messages' order by ordinal_position;`)));
