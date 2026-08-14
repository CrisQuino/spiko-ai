-- Migration 008: store the full conversation transcript per lesson so a
-- session can be reviewed in the app (conversation + CEFR metrics + feedback).
alter table public.lesson_costs add column if not exists transcript jsonb;
