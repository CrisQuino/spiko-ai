-- Migration 007:
-- 1) store the generated scenario title per lesson (dashboard history showed
--    everything as "Database" because it fell back to scenario_type).
-- 2) an admin view of individual recent lessons across ALL users (with email),
--    so the admin dashboard can show who is using the system. It is owned by
--    postgres so it bypasses lesson_costs RLS (admins read all rows).

alter table public.lesson_costs add column if not exists scenario_title text;

create or replace view public.admin_recent_lessons as
select
  lc.id,
  lc.lesson_id,
  lc.scenario_type,
  lc.scenario_title,
  lc.completed_at,
  lc.duration_seconds,
  lc.total_cost,
  lc.total_tokens,
  lc.cefr_overall,
  lc.user_id,
  p.email,
  p.full_name
from public.lesson_costs lc
left join public.profiles p on p.id = lc.user_id
where lc.completed_at is not null
order by lc.completed_at desc;

grant select on public.admin_recent_lessons to anon, authenticated;
