-- Migration 006: align admin cost views with the app's expected columns.
-- The admin dashboard (src/lib/admin-queries.ts) reads lessons_count,
-- unique_users, avg_cost_per_lesson, avg_duration_seconds, input/output_tokens,
-- and a monthly view — none of which the old views exposed, so everything
-- showed 0. Recreate them from lesson_costs with matching column names.

drop view if exists public.admin_daily_costs;
create view public.admin_daily_costs as
select
  date(completed_at)                                            as date,
  count(*)::int                                                 as lessons_count,
  count(distinct user_id)::int                                  as unique_users,
  coalesce(sum(total_tokens), 0)::bigint                        as total_tokens,
  coalesce(sum(input_tokens), 0)::bigint                        as input_tokens,
  coalesce(sum(output_tokens), 0)::bigint                       as output_tokens,
  coalesce(sum(total_cost), 0)::numeric                         as total_cost,
  case when count(*) > 0 then (coalesce(sum(total_cost), 0) / count(*))::numeric else 0 end as avg_cost_per_lesson,
  coalesce(avg(duration_seconds), 0)::numeric                   as avg_duration_seconds
from public.lesson_costs
where completed_at is not null
group by date(completed_at)
order by date(completed_at) desc;

drop view if exists public.admin_monthly_costs;
create view public.admin_monthly_costs as
select
  to_char(date_trunc('month', completed_at), 'YYYY-MM')        as month,
  count(*)::int                                                as lessons_count,
  count(distinct user_id)::int                                 as unique_users,
  coalesce(sum(total_tokens), 0)::bigint                       as total_tokens,
  coalesce(sum(total_cost), 0)::numeric                        as total_cost,
  case when count(*) > 0 then (coalesce(sum(total_cost), 0) / count(*))::numeric else 0 end as avg_cost_per_lesson
from public.lesson_costs
where completed_at is not null
group by date_trunc('month', completed_at)
order by date_trunc('month', completed_at) desc;

drop view if exists public.admin_top_users;
create view public.admin_top_users as
select
  lc.user_id,
  p.email,
  count(*)::int                                                as lessons_count,
  coalesce(sum(lc.total_cost), 0)::numeric                     as total_cost,
  case when count(*) > 0 then (coalesce(sum(lc.total_cost), 0) / count(*))::numeric else 0 end as avg_cost_per_lesson,
  max(lc.completed_at)                                         as last_lesson_at
from public.lesson_costs lc
left join public.profiles p on p.id = lc.user_id
where lc.completed_at is not null
group by lc.user_id, p.email
order by count(*) desc;

grant select on public.admin_daily_costs, public.admin_monthly_costs, public.admin_top_users to anon, authenticated;
