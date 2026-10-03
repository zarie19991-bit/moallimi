-- Deployed directly to Supabase project udznpifopbnrcgxtpzza
create table if not exists public.maintenance_agent_evaluation_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  source_type text not null check (source_type in ('assessment','paper_review','bank')),
  source_id text not null,
  title text not null default '',
  report jsonb not null default '{}'::jsonb,
  contains_personal_data boolean not null default false check (contains_personal_data=false),
  created_at timestamptz not null default now()
);
create index if not exists maintenance_agent_evaluation_reports_owner_created_idx
  on public.maintenance_agent_evaluation_reports(owner_id,created_at desc);
create index if not exists maintenance_agent_evaluation_reports_source_idx
  on public.maintenance_agent_evaluation_reports(source_type,source_id,created_at desc);
alter table public.maintenance_agent_evaluation_reports enable row level security;
revoke all on table public.maintenance_agent_evaluation_reports from anon, authenticated;
grant select,insert,delete on table public.maintenance_agent_evaluation_reports to service_role;
