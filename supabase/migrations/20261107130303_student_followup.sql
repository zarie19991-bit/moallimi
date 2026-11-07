create table public.nafes_student_followup (
  student_id uuid not null references public.nafes_students(id) on delete cascade,
  subject text not null check (subject in ('reading','math','science')),
  payload jsonb not null default '{"tasks":[],"notes":[],"reviews":{}}'::jsonb
    check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=100000),
  version integer not null default 1 check (version>0),
  updated_by uuid references public.nafes_teacher_access(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(student_id,subject)
);
alter table public.nafes_student_followup enable row level security;
revoke all on public.nafes_student_followup from anon,authenticated;
grant select,insert,update,delete on public.nafes_student_followup to service_role;
create index nafes_followup_updated_by_idx on public.nafes_student_followup(updated_by);
comment on table public.nafes_student_followup is 'Teacher subject-scoped follow-up; authenticated nafes-exam handler only, optimistic version locking.';
