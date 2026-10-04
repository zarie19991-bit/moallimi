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
