-- Handoff protocol between the in-platform maintenance agent and the assistant.
-- Stores only sanitized diagnostic metadata and repair status. No student PII or secrets.

create table if not exists public.maintenance_agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  run_id uuid not null references public.maintenance_agent_runs(id) on delete cascade,
  area text not null check (area in ('printing','question_quality','database_security','runtime')),
  source text,
  status text not null default 'needs_assistant'
    check (status in ('needs_assistant','fix_in_progress','fix_ready','verified','verification_failed','closed')),
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  source_files text[] not null default '{}'::text[],
  verification jsonb not null default '{}'::jsonb,
  fix jsonb not null default '{}'::jsonb,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create unique index if not exists maintenance_agent_handoffs_owner_run_uidx
  on public.maintenance_agent_handoffs(owner_id,run_id);

create index if not exists maintenance_agent_handoffs_owner_status_idx
  on public.maintenance_agent_handoffs(owner_id,status,updated_at desc);

alter table public.maintenance_agent_handoffs enable row level security;
revoke all on table public.maintenance_agent_handoffs from anon, authenticated;
grant select, insert, update on table public.maintenance_agent_handoffs to service_role;
