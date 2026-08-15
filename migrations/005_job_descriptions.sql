-- Migration 005: Job Descriptions
-- Stores job descriptions used to generate practice scenarios.
-- Visibility: a user can see their OWN JDs and JDs belonging to their COMPANY (team).

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_descriptions_user_id_idx on public.job_descriptions(user_id);
create index if not exists job_descriptions_company_id_idx on public.job_descriptions(company_id);

-- Keep updated_at fresh
create or replace function public.job_descriptions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_job_descriptions_updated_at on public.job_descriptions;
create trigger set_job_descriptions_updated_at
  before update on public.job_descriptions
  for each row
  execute function public.job_descriptions_set_updated_at();

-- Row Level Security
alter table public.job_descriptions enable row level security;

-- SELECT: own JDs, or JDs from the same company (team)
drop policy if exists jd_select_own_or_company on public.job_descriptions;
create policy jd_select_own_or_company on public.job_descriptions
  for select
  using (
    user_id = auth.uid()
    or (
      company_id is not null
      and company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
    )
  );

-- INSERT: must own the row; company_id must be null or the user's own company
drop policy if exists jd_insert_own on public.job_descriptions;
create policy jd_insert_own on public.job_descriptions
  for insert
  with check (
    user_id = auth.uid()
    and (
      company_id is null
      or company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
    )
  );

-- UPDATE: only the owner
drop policy if exists jd_update_own on public.job_descriptions;
create policy jd_update_own on public.job_descriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: only the owner
drop policy if exists jd_delete_own on public.job_descriptions;
create policy jd_delete_own on public.job_descriptions
  for delete
  using (user_id = auth.uid());
