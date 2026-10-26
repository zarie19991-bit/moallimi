-- Tamakkun: durable per-student per-day observed activity (Asia/Riyadh).
-- STAGED SQL ONLY. Do NOT run on production without dry-run, rollback plan and approval.
-- Copy into a migration generated using "supabase migration new tamakkun_daily_activity".
-- Requires public.lugati_sessions, public.nafes_students.
-- Does not backfill expired/historical sessions or infer activity on intermediate days.

begin;

create schema if not exists tamakkun_internal;
revoke all on schema tamakkun_internal from public, anon, authenticated;
grant usage on schema tamakkun_internal to service_role;

create table if not exists public.tamakkun_student_activity_days (
  student_id uuid not null references public.nafes_students(id) on delete cascade,
  activity_day date not null,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  login_events integer not null default 0 check (login_events >= 0),
  heartbeat_events integer not null default 0 check (heartbeat_events >= 0),
  primary key (student_id, activity_day),
  constraint activity_days_chronology check (last_observed_at >= first_observed_at),
  constraint activity_days_has_event check (login_events + heartbeat_events > 0)
);
create index if not exists ix_tamakkun_student_activity_days_date
  on public.tamakkun_student_activity_days(activity_day, student_id);

alter table public.tamakkun_student_activity_days enable row level security;
revoke all on public.tamakkun_student_activity_days from public, anon, authenticated;
grant select, insert, update on public.tamakkun_student_activity_days to service_role;
-- No anon/authenticated policies. Only the service_role Edge Function can read it.

create table if not exists public.tamakkun_activity_tracking_config (
  singleton boolean primary key default true check (singleton),
  recording_started_at timestamptz not null default now(),
  complete_from_day date not null
);
alter table public.tamakkun_activity_tracking_config enable row level security;
revoke all on public.tamakkun_activity_tracking_config from public, anon, authenticated;
grant select on public.tamakkun_activity_tracking_config to service_role;

-- The calendar day on which the trigger is installed is incomplete.
-- New daily absence calculations can be considered calendar-day complete only the next Riyadh day.
insert into public.tamakkun_activity_tracking_config(singleton, recording_started_at, complete_from_day)
values (true, now(), ((now() at time zone 'Asia/Riyadh')::date + 1))
on conflict (singleton) do nothing;

create or replace function tamakkun_internal.capture_lugati_session_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  observed_at timestamptz;
  observed_day date;
begin
  if new.role <> 'student' or new.student_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    observed_at := coalesce(new.created_at, clock_timestamp());
    observed_day := (observed_at at time zone 'Asia/Riyadh')::date;
    insert into public.tamakkun_student_activity_days
      (student_id, activity_day, first_observed_at, last_observed_at, login_events, heartbeat_events)
    values (new.student_id, observed_day, observed_at, observed_at, 1, 0)
    on conflict (student_id, activity_day) do update
      set first_observed_at = least(public.tamakkun_student_activity_days.first_observed_at, excluded.first_observed_at),
          last_observed_at = greatest(public.tamakkun_student_activity_days.last_observed_at, excluded.last_observed_at),
          login_events = public.tamakkun_student_activity_days.login_events + 1;

    -- Some sessions can arrive already carrying a separately dated activity stamp.
    if new.last_seen_at is not null
       and (new.last_seen_at at time zone 'Asia/Riyadh')::date <> observed_day then
      observed_at := new.last_seen_at;
      observed_day := (observed_at at time zone 'Asia/Riyadh')::date;
      insert into public.tamakkun_student_activity_days
        (student_id, activity_day, first_observed_at, last_observed_at, login_events, heartbeat_events)
      values (new.student_id, observed_day, observed_at, observed_at, 0, 1)
      on conflict (student_id, activity_day) do update
        set first_observed_at = least(public.tamakkun_student_activity_days.first_observed_at, excluded.first_observed_at),
            last_observed_at = greatest(public.tamakkun_student_activity_days.last_observed_at, excluded.last_observed_at),
            heartbeat_events = public.tamakkun_student_activity_days.heartbeat_events + 1;
    end if;

  elsif tg_op = 'UPDATE' and new.last_seen_at is distinct from old.last_seen_at then
    observed_at := coalesce(new.last_seen_at, clock_timestamp());
    observed_day := (observed_at at time zone 'Asia/Riyadh')::date;
    insert into public.tamakkun_student_activity_days
      (student_id, activity_day, first_observed_at, last_observed_at, login_events, heartbeat_events)
    values (new.student_id, observed_day, observed_at, observed_at, 0, 1)
    on conflict (student_id, activity_day) do update
      set first_observed_at = least(public.tamakkun_student_activity_days.first_observed_at, excluded.first_observed_at),
          last_observed_at = greatest(public.tamakkun_student_activity_days.last_observed_at, excluded.last_observed_at),
          heartbeat_events = public.tamakkun_student_activity_days.heartbeat_events + 1;
  end if;
  return new;
end;
$body$;

revoke all on function tamakkun_internal.capture_lugati_session_activity() from public, anon, authenticated;
grant execute on function tamakkun_internal.capture_lugati_session_activity() to service_role;

do $block$
begin
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.lugati_sessions'::regclass
                   and tgname = 'trg_tamakkun_student_login_daily') then
    create trigger trg_tamakkun_student_login_daily
      after insert on public.lugati_sessions
      for each row when (new.role = 'student' and new.student_id is not null)
      execute function tamakkun_internal.capture_lugati_session_activity();
  end if;
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.lugati_sessions'::regclass
                   and tgname = 'trg_tamakkun_student_heartbeat_daily') then
    create trigger trg_tamakkun_student_heartbeat_daily
      after update of last_seen_at on public.lugati_sessions
      for each row when (new.role = 'student'
                          and new.student_id is not null
                          and old.last_seen_at is distinct from new.last_seen_at)
      execute function tamakkun_internal.capture_lugati_session_activity();
  end if;
end
$block$;

commit;

-- After applying on an isolated staging database, verify:
-- select * from public.tamakkun_activity_tracking_config;
-- select tgname from pg_trigger where tgrelid='public.lugati_sessions'::regclass and not tgisinternal;
-- select activity_day,count(*) from public.tamakkun_student_activity_days group by activity_day;
-- Do not insert synthetic sessions into a live database to test the trigger.
