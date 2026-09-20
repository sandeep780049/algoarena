-- Platform stats for the homepage without exposing the questions table
-- (view runs with owner rights, bypassing RLS, but only ever returns counts)
create or replace view public.platform_stats as
select
  (select count(*) from public.questions) as questions_count,
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.contests where is_published) as contests_count;

grant select on public.platform_stats to anon, authenticated;

-- Single-use admin bootstrap: the FIRST-ever signup becomes admin,
-- then this trigger deletes itself so it can never fire again.
create or replace function public.bootstrap_first_admin()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  admin_count int;
begin
  select count(*) into admin_count from public.user_roles where role = 'admin';
  if admin_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  drop trigger if exists on_auth_user_created_bootstrap on auth.users;
  drop function if exists public.bootstrap_first_admin();
  return new;
end;
$$;

create trigger on_auth_user_created_bootstrap
after insert on auth.users
for each row execute function public.bootstrap_first_admin();

-- Seed sample contests (no-ops if the codes already exist)
insert into public.contests (name, description, contest_type, contest_code, start_time, duration_minutes, status, is_published)
values
  ('Live DSA Sprint', 'A quick 10-question sprint across arrays, strings, and logic — live right now!', 'special', 'SPRINT-001', now() - interval '15 minutes', 30, 'live', true),
  ('Daily Dose of DSA', 'Ten questions to warm up your problem-solving every day.', 'daily', 'DAILY-001', date_trunc('hour', now()) + interval '4 hours', 25, 'upcoming', true),
  ('Weekly Challenge #1', 'The first weekly championship — 20 questions, 45 minutes, top of the leaderboard takes it.', 'weekly', 'WEEKLY-001', date_trunc('day', now()) + interval '1 day' + interval '18 hours', 45, 'upcoming', true)
on conflict (contest_code) do nothing;

-- Attach 10 random questions to each seeded contest that has none yet
insert into public.contest_questions (contest_id, question_id, order_index)
select c.id, q.id, row_number() over (order by q.id)
from public.contests c
cross join lateral (select id from public.questions order by random() limit 10) q
where c.contest_code in ('SPRINT-001', 'DAILY-001', 'WEEKLY-001')
  and not exists (select 1 from public.contest_questions cq where cq.contest_id = c.id);
