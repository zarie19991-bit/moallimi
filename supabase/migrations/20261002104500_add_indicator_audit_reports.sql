-- Per-indicator deep audit details for the maintenance agent.
-- Stores only question-quality metadata and short question excerpts; no student data or secrets.

create table if not exists public.maintenance_agent_indicator_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.maintenance_agent_runs(id) on delete cascade,
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  subject text not null check (subject in ('reading','math','science')),
  indicator_key text not null,
  indicator_text text not null default '',
  question_count integer not null default 0 check (question_count >= 0),
  levels jsonb not null default '{}'::jsonb,
  issues jsonb not null default '{}'::jsonb,
  samples jsonb not null default '[]'::jsonb,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now(),
  unique(run_id, indicator_key)
);

create index if not exists maintenance_agent_indicator_reports_run_idx
  on public.maintenance_agent_indicator_reports(run_id, subject, indicator_key);

alter table public.maintenance_agent_indicator_reports enable row level security;
revoke all on table public.maintenance_agent_indicator_reports from anon, authenticated;
grant select, insert, update, delete on table public.maintenance_agent_indicator_reports to service_role;
