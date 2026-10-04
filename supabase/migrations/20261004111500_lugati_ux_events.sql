-- Privacy-minimal UX events for Tamakkun engagement measurement.
create table if not exists public.lugati_ux_events(
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('student','teacher')),
  student_id uuid null references public.nafes_students(id) on delete cascade,
  teacher_access_id uuid null references public.nafes_teacher_access(id) on delete cascade,
  event_name text not null check (char_length(event_name) between 1 and 64),
  area text not null default '' check (char_length(area) <= 48),
  variant text not null default 'ux_v3' check (char_length(variant) <= 32),
  elapsed_ms integer null check (elapsed_ms is null or (elapsed_ms >= 0 and elapsed_ms <= 7200000)),
  created_at timestamptz not null default now(),
  check (
    (role='student' and student_id is not null and teacher_access_id is null)
    or
    (role='teacher' and teacher_access_id is not null and student_id is null)
  )
);

create index if not exists lugati_ux_events_student_time_idx on public.lugati_ux_events(student_id,created_at desc) where role='student';
create index if not exists lugati_ux_events_teacher_time_idx on public.lugati_ux_events(teacher_access_id,created_at desc) where role='teacher';
create index if not exists lugati_ux_events_event_time_idx on public.lugati_ux_events(event_name,created_at desc);
create index if not exists lugati_ux_events_variant_time_idx on public.lugati_ux_events(variant,created_at desc);

alter table public.lugati_ux_events enable row level security;
revoke all on table public.lugati_ux_events from public,anon,authenticated;
grant select,insert,delete on table public.lugati_ux_events to service_role;

comment on table public.lugati_ux_events is
'Privacy-minimal product analytics: internal account id, event, section, UI variant and elapsed time only. No names, answers or question text.';


create or replace view public.lugati_ux_metrics_daily as
with student_day as (
  select
    created_at::date as metric_date,
    variant,
    student_id,
    bool_or(event_name='student_workspace_view') as opened_workspace,
    bool_or(event_name='student_task_start') as started_task,
    bool_or(event_name='student_task_complete') as completed_task,
    bool_or(event_name='student_onboarding_complete') as completed_onboarding,
    min(elapsed_ms) filter (where event_name='student_task_start') as first_task_start_ms
  from public.lugati_ux_events
  where role='student' and student_id is not null
  group by created_at::date,variant,student_id
)
select
  metric_date,
  variant,
  count(*) filter (where opened_workspace)::int as active_students,
  count(*) filter (where started_task)::int as students_started_task,
  count(*) filter (where completed_task)::int as students_completed_task,
  count(*) filter (where completed_onboarding)::int as students_completed_onboarding,
  round(
    (100.0*count(*) filter (where started_task)/nullif(count(*) filter (where opened_workspace),0))::numeric,1
  ) as activation_rate,
  round(
    (100.0*count(*) filter (where completed_task)/nullif(count(*) filter (where started_task),0))::numeric,1
  ) as completion_rate,
  percentile_cont(0.5) within group (order by first_task_start_ms)
    filter (where first_task_start_ms is not null) as median_first_task_start_ms
from student_day
group by metric_date,variant;

revoke all on public.lugati_ux_metrics_daily from public,anon,authenticated;
grant select on public.lugati_ux_metrics_daily to service_role;
