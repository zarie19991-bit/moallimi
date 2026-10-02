-- Per-assessment audit details for generated indicator tests.
-- Stores only assessment metadata and quality findings; no student attempts or roster data.

create table if not exists public.maintenance_agent_assessment_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.maintenance_agent_runs(id) on delete cascade,
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  assessment_id uuid not null references public.nafes_assessments(id) on delete cascade,
  title text not null default '',
  status text not null default '',
  subject text not null default '',
  question_count integer not null default 0 check (question_count >= 0),
  indicator_count integer not null default 0 check (indicator_count >= 0),
  levels jsonb not null default '{}'::jsonb,
  answer_positions jsonb not null default '{}'::jsonb,
  issues jsonb not null default '{}'::jsonb,
  samples jsonb not null default '[]'::jsonb,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now(),
  unique(run_id, assessment_id)
);

create index if not exists maintenance_agent_assessment_reports_run_idx
  on public.maintenance_agent_assessment_reports(run_id, status, subject, assessment_id);

alter table public.maintenance_agent_assessment_reports enable row level security;
revoke all on table public.maintenance_agent_assessment_reports from anon, authenticated;
grant select, insert, update, delete on table public.maintenance_agent_assessment_reports to service_role;
